import { useEffect, useMemo, useRef, useState } from "react";
import { angleOf, normalize, radiansToDegrees, scale, sub } from "../domain/geometry";
import {
  buildInvoluteGearPath,
  buildRackPath,
  computeVisualGearPhases,
  deriveGearGeometry,
  deriveRackGeometry,
} from "../domain/gears";
import type { MechanismDocument, MechanismPart, PartId, SimulationFrame } from "../domain/mechanism";

interface MechanismViewportProps {
  document: MechanismDocument;
  frame: SimulationFrame;
  selectedPartId: PartId | null;
  isPaused: boolean;
  onSelectPart: (partId: PartId | null) => void;
  onMovePart: (partId: PartId, x: number, y: number) => void;
}

interface GearShapeProps {
  part: Extract<MechanismPart, { type: "gear" }>;
  frame: SimulationFrame;
  selected: boolean;
  visualPhase: number;
}

interface DragState {
  partId: PartId;
  startPointer: { x: number; y: number };
  startPosition: { x: number; y: number };
}

interface PanState {
  startPointer: { x: number; y: number };
  startCenter: { x: number; y: number };
}

const canDragPart = (part: MechanismPart): boolean => part.type !== "rod";
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.15;

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

const partStroke = (part: MechanismPart): string => part.style?.stroke ?? "#111111";
const selectedStroke = "#111111";
const constructionStroke = "#d8d8d8";
const centerlineStroke = "#bfbfbf";

const GearShape = ({
  part,
  frame,
  selected,
  visualPhase,
}: GearShapeProps) => {
  const pose = frame.poses[part.id];
  const geometry = deriveGearGeometry(part.params);
  const gearPath = buildInvoluteGearPath(geometry);

  return (
    <g
      transform={`translate(${pose.position.x} ${pose.position.y}) rotate(${radiansToDegrees(
        pose.rotation + visualPhase,
      )})`}
    >
      <path
        d={gearPath}
        fill="#ffffff"
        stroke={selected ? selectedStroke : partStroke(part)}
        strokeWidth={selected ? 3 : 2.2}
      />
      <circle r={geometry.pitchRadius} fill="none" stroke={centerlineStroke} strokeWidth={1} strokeDasharray="8 6" />
      <circle r={geometry.baseRadius} fill="none" stroke={constructionStroke} strokeWidth={0.9} strokeDasharray="5 5" opacity={0.7} />
      <circle r={geometry.boreRadius} fill="#ffffff" stroke={partStroke(part)} strokeWidth={1.8} />
      <line
        x1={-geometry.outerRadius - 10}
        y1={0}
        x2={geometry.outerRadius + 10}
        y2={0}
        stroke={centerlineStroke}
        strokeWidth={1}
        strokeDasharray="8 6"
        opacity={0.75}
      />
      <line
        x1={0}
        y1={-geometry.outerRadius - 10}
        x2={0}
        y2={geometry.outerRadius + 10}
        stroke={centerlineStroke}
        strokeWidth={1}
        strokeDasharray="8 6"
        opacity={0.75}
      />
    </g>
  );
};

const RackShape = ({
  part,
  frame,
  selected,
}: {
  part: Extract<MechanismPart, { type: "rack" }>;
  frame: SimulationFrame;
  selected: boolean;
}) => {
  const pose = frame.poses[part.id];
  const halfLength = part.params.length / 2;
  const rackGeometry = deriveRackGeometry(part.params);
  const rackPath = buildRackPath(part.params, rackGeometry);
  const axisAngle = radiansToDegrees(angleOf(normalize(part.params.axis)));
  const pitchY = -part.params.height / 2 + rackGeometry.dedendum;

  return (
    <g transform={`translate(${pose.position.x} ${pose.position.y}) rotate(${axisAngle})`}>
      <path
        d={rackPath}
        fill="#ffffff"
        stroke={selected ? selectedStroke : partStroke(part)}
        strokeWidth={selected ? 3 : 2.2}
      />
      <line
        x1={-halfLength}
        y1={pitchY}
        x2={halfLength}
        y2={pitchY}
        stroke={centerlineStroke}
        strokeDasharray="8 6"
        strokeWidth={1}
      />
    </g>
  );
};

const CrankShape = ({
  part,
  frame,
  selected,
}: {
  part: Extract<MechanismPart, { type: "crank" }>;
  frame: SimulationFrame;
  selected: boolean;
}) => {
  const pose = frame.poses[part.id];
  const pivot = pose.anchors.pivot;
  const pin = pose.anchors.pin;

  return (
    <g>
      <circle
        cx={pivot.x}
        cy={pivot.y}
        r={11}
        fill="#ffffff"
        stroke={selected ? selectedStroke : partStroke(part)}
        strokeWidth={selected ? 3 : 2.2}
      />
      <line
        x1={pivot.x}
        y1={pivot.y}
        x2={pin.x}
        y2={pin.y}
        stroke={partStroke(part)}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <circle cx={pin.x} cy={pin.y} r={10} fill="#ffffff" stroke={partStroke(part)} strokeWidth={2} />
      <line
        x1={pivot.x - 16}
        y1={pivot.y}
        x2={pin.x + 16}
        y2={pin.y}
        stroke={centerlineStroke}
        strokeDasharray="8 6"
        strokeWidth={1}
      />
    </g>
  );
};

const SliderShape = ({
  part,
  frame,
  selected,
}: {
  part: Extract<MechanismPart, { type: "slider" }>;
  frame: SimulationFrame;
  selected: boolean;
}) => {
  const pose = frame.poses[part.id];
  const origin = part.frame.position;
  const axis = normalize(part.params.axis);
  const axisAngle = radiansToDegrees(angleOf(axis));
  const start = sub(origin, scale(axis, part.params.travelMin));
  const end = sub(origin, scale(axis, -part.params.travelMax));

  return (
    <g>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={constructionStroke}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.8}
      />
      <g transform={`translate(${pose.position.x} ${pose.position.y}) rotate(${axisAngle})`}>
        <rect
          x={-part.params.width / 2}
          y={-part.params.height / 2}
          width={part.params.width}
          height={part.params.height}
          rx={12}
          fill="#ffffff"
          stroke={selected ? selectedStroke : partStroke(part)}
          strokeWidth={selected ? 3 : 2.2}
        />
      </g>
    </g>
  );
};

const RodShape = ({
  part,
  frame,
  selected,
}: {
  part: Extract<MechanismPart, { type: "rod" }>;
  frame: SimulationFrame;
  selected: boolean;
}) => {
  const pose = frame.poses[part.id];
  const a = pose.anchors.a;
  const b = pose.anchors.b;

  return (
    <g>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={selected ? selectedStroke : partStroke(part)}
        strokeWidth={part.params.thickness}
        strokeLinecap="round"
      />
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="#ffffff"
        strokeWidth={Math.max(2, part.params.thickness - 6)}
        strokeLinecap="round"
      />
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={centerlineStroke}
        strokeDasharray="8 6"
        strokeWidth={1}
      />
      <circle cx={a.x} cy={a.y} r={8} fill="#ffffff" stroke={partStroke(part)} strokeWidth={2} />
      <circle cx={b.x} cy={b.y} r={8} fill="#ffffff" stroke={partStroke(part)} strokeWidth={2} />
    </g>
  );
};

const PivotShape = ({
  part,
  frame,
  selected,
}: {
  part: Extract<MechanismPart, { type: "pivot" }>;
  frame: SimulationFrame;
  selected: boolean;
}) => {
  const pose = frame.poses[part.id];

  return (
    <g transform={`translate(${pose.position.x} ${pose.position.y})`}>
      <circle
        r={part.params.displayRadius}
        fill="#ffffff"
        stroke={selected ? selectedStroke : partStroke(part)}
        strokeWidth={selected ? 3 : 2.2}
      />
      <path
        d={`M ${-part.params.displayRadius - 8} ${part.params.displayRadius + 12} L 0 ${part.params.displayRadius - 2} L ${part.params.displayRadius + 8} ${part.params.displayRadius + 12}`}
        stroke={partStroke(part)}
        strokeWidth={2}
        fill="none"
        opacity={0.8}
      />
    </g>
  );
};

export const MechanismViewport = ({
  document,
  frame,
  selectedPartId,
  isPaused,
  onSelectPart,
  onMovePart,
}: MechanismViewportProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [isPanShortcutActive, setIsPanShortcutActive] = useState(false);
  const [camera, setCamera] = useState(() => ({
    center: {
      x: document.view.width / 2,
      y: document.view.height / 2,
    },
    zoom: 1,
  }));
  const gearPhases = useMemo(() => computeVisualGearPhases(document), [document]);
  const selectedPart =
    selectedPartId ? document.parts.find((part) => part.id === selectedPartId) ?? null : null;
  const viewportWidth = document.view.width / camera.zoom;
  const viewportHeight = document.view.height / camera.zoom;
  const viewMinX = camera.center.x - viewportWidth / 2;
  const viewMinY = camera.center.y - viewportHeight / 2;
  const viewMaxX = viewMinX + viewportWidth;
  const viewMaxY = viewMinY + viewportHeight;

  const gridLines = useMemo(() => {
    const marginX = viewportWidth;
    const marginY = viewportHeight;
    const startX =
      Math.floor((viewMinX - marginX) / document.view.grid) * document.view.grid;
    const endX =
      Math.ceil((viewMaxX + marginX) / document.view.grid) * document.view.grid;
    const startY =
      Math.floor((viewMinY - marginY) / document.view.grid) * document.view.grid;
    const endY =
      Math.ceil((viewMaxY + marginY) / document.view.grid) * document.view.grid;
    const vertical: number[] = [];
    const horizontal: number[] = [];

    for (let x = startX; x <= endX; x += document.view.grid) {
      vertical.push(x);
    }

    for (let y = startY; y <= endY; y += document.view.grid) {
      horizontal.push(y);
    }

    return { vertical, horizontal };
  }, [
    document.view.grid,
    viewMaxX,
    viewMaxY,
    viewMinX,
    viewMinY,
    viewportHeight,
    viewportWidth,
  ]);
  const selectedPose = selectedPart ? frame.poses[selectedPart.id] : null;
  const calloutX = selectedPose
    ? selectedPose.position.x < camera.center.x
      ? viewMaxX - 286
      : viewMinX + 52
    : viewMinX + 52;
  const calloutY = selectedPose
    ? clamp(selectedPose.position.y - 72, viewMinY + 64, viewMaxY - 154)
    : viewMinY + 64;

  const eventToPoint = (event: { clientX: number; clientY: number }) => {
    const bounds = svgRef.current?.getBoundingClientRect();

    if (!bounds) {
      return { x: 0, y: 0 };
    }

    return {
      x: viewMinX + ((event.clientX - bounds.left) / bounds.width) * viewportWidth,
      y: viewMinY + ((event.clientY - bounds.top) / bounds.height) * viewportHeight,
    };
  };

  const updateZoom = (factor: number, anchor?: { x: number; y: number }) => {
    setCamera((current) => {
      const nextZoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);

      if (nextZoom === current.zoom) {
        return current;
      }

      if (!anchor) {
        return {
          ...current,
          zoom: nextZoom,
        };
      }

      const currentWidth = document.view.width / current.zoom;
      const currentHeight = document.view.height / current.zoom;
      const currentMinX = current.center.x - currentWidth / 2;
      const currentMinY = current.center.y - currentHeight / 2;
      const nextWidth = document.view.width / nextZoom;
      const nextHeight = document.view.height / nextZoom;
      const anchorRatioX = (anchor.x - currentMinX) / currentWidth;
      const anchorRatioY = (anchor.y - currentMinY) / currentHeight;
      const nextMinX = anchor.x - anchorRatioX * nextWidth;
      const nextMinY = anchor.y - anchorRatioY * nextHeight;

      return {
        center: {
          x: nextMinX + nextWidth / 2,
          y: nextMinY + nextHeight / 2,
        },
        zoom: nextZoom,
      };
    });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.code === "Space") {
        event.preventDefault();
        setIsPanShortcutActive(true);
        return;
      }

      if (key === "z") {
        event.preventDefault();
        updateZoom(ZOOM_STEP);
        return;
      }

      if (key === "x") {
        event.preventDefault();
        updateZoom(1 / ZOOM_STEP);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        setIsPanShortcutActive(false);
      }
    };

    const handleBlur = () => setIsPanShortcutActive(false);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [document.view.height, document.view.width]);

  const beginDrag = (
    event: React.PointerEvent<SVGGElement>,
    part: MechanismPart,
  ) => {
    if (isPanShortcutActive) {
      const pointer = eventToPoint(event);

      setPanState({
        startPointer: pointer,
        startCenter: camera.center,
      });
      setDragState(null);
      return;
    }

    onSelectPart(part.id);

    if (!isPaused || !canDragPart(part)) {
      return;
    }

    const pointer = eventToPoint(event);

    setDragState({
      partId: part.id,
      startPointer: pointer,
      startPosition: part.frame.position,
    });
  };

  const beginPan = (event: React.PointerEvent<SVGSVGElement>) => {
    const pointer = eventToPoint(event);

    setPanState({
      startPointer: pointer,
      startCenter: camera.center,
    });
    setDragState(null);
  };

  const renderPart = (part: MechanismPart) => {
    const selected = part.id === selectedPartId;

    switch (part.type) {
      case "gear":
        return (
          <GearShape
            part={part}
            frame={frame}
            selected={selected}
            visualPhase={gearPhases[part.id] ?? 0}
          />
        );
      case "rack":
        return <RackShape part={part} frame={frame} selected={selected} />;
      case "crank":
        return <CrankShape part={part} frame={frame} selected={selected} />;
      case "slider":
        return <SliderShape part={part} frame={frame} selected={selected} />;
      case "rod":
        return <RodShape part={part} frame={frame} selected={selected} />;
      case "pivot":
        return <PivotShape part={part} frame={frame} selected={selected} />;
    }
  };

  return (
    <div
      className={`viewport-shell ${panState ? "is-panning" : ""} ${
        isPanShortcutActive ? "pan-shortcut-active" : ""
      }`}
    >
      <svg
        ref={svgRef}
        className="viewport"
        viewBox={`${viewMinX} ${viewMinY} ${viewportWidth} ${viewportHeight}`}
        onPointerMove={(event) => {
          if (panState) {
            const pointer = eventToPoint(event);
            const delta = sub(pointer, panState.startPointer);

            setCamera((current) => ({
              ...current,
              center: {
                x: panState.startCenter.x - delta.x,
                y: panState.startCenter.y - delta.y,
              },
            }));
            return;
          }

          if (dragState) {
            const pointer = eventToPoint(event);
            const delta = sub(pointer, dragState.startPointer);
            onMovePart(
              dragState.partId,
              dragState.startPosition.x + delta.x,
              dragState.startPosition.y + delta.y,
            );
          }
        }}
        onPointerUp={() => {
          setDragState(null);
          setPanState(null);
        }}
        onPointerLeave={() => {
          setDragState(null);
          setPanState(null);
        }}
        onPointerDown={(event) => beginPan(event)}
        onWheel={(event) => {
          event.preventDefault();
          const anchor = eventToPoint(event);
          const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
          updateZoom(factor, anchor);
        }}
      >
        <rect
          x={viewMinX - viewportWidth}
          y={viewMinY - viewportHeight}
          width={viewportWidth * 3}
          height={viewportHeight * 3}
          fill="#ffffff"
        />
        {gridLines.vertical.map((x) => (
          <line
            key={`v-${x}`}
            x1={x}
            y1={viewMinY - viewportHeight}
            x2={x}
            y2={viewMaxY + viewportHeight}
            stroke="#000000"
            strokeOpacity={x % (document.view.grid * 5) === 0 ? 0.1 : 0.04}
            strokeWidth={1}
          />
        ))}
        {gridLines.horizontal.map((y) => (
          <line
            key={`h-${y}`}
            x1={viewMinX - viewportWidth}
            y1={y}
            x2={viewMaxX + viewportWidth}
            y2={y}
            stroke="#000000"
            strokeOpacity={y % (document.view.grid * 5) === 0 ? 0.1 : 0.04}
            strokeWidth={1}
          />
        ))}
        {document.parts.map((part) => (
          <g
            key={part.id}
            onPointerDown={(event) => {
              event.stopPropagation();
              beginDrag(event, part);
            }}
          >
            {renderPart(part)}
          </g>
        ))}
        {selectedPart && selectedPose ? (
          <g pointerEvents="none">
            <line
              x1={selectedPose.position.x}
              y1={selectedPose.position.y}
              x2={calloutX + 18}
              y2={calloutY + 30}
              stroke={selectedStroke}
              strokeWidth={1.2}
            />
            <circle
              cx={selectedPose.position.x}
              cy={selectedPose.position.y}
              r={5}
              fill="#ffffff"
              stroke={selectedStroke}
              strokeWidth={1.4}
            />
            <line
              x1={selectedPose.position.x}
              y1={viewMinY - viewportHeight}
              x2={selectedPose.position.x}
              y2={viewMaxY + viewportHeight}
              stroke={centerlineStroke}
              strokeDasharray="7 7"
              strokeWidth={0.9}
              opacity={0.45}
            />
            <line
              x1={viewMinX - viewportWidth}
              y1={selectedPose.position.y}
              x2={viewMaxX + viewportWidth}
              y2={selectedPose.position.y}
              stroke={centerlineStroke}
              strokeDasharray="7 7"
              strokeWidth={0.9}
              opacity={0.45}
            />
            <rect
              x={calloutX}
              y={calloutY}
              width={234}
              height={76}
              fill="#ffffff"
              stroke={selectedStroke}
              strokeWidth={1.2}
            />
            <text
              x={calloutX + 14}
              y={calloutY + 22}
              fill={selectedStroke}
              fontFamily="Consolas, monospace"
              fontSize="10"
              letterSpacing="1.6"
            >
              ACTIVE CALLOUT
            </text>
            <text
              x={calloutX + 14}
              y={calloutY + 44}
              fill="#171612"
              fontFamily="Bahnschrift, Arial Narrow, sans-serif"
              fontSize="18"
              fontWeight="700"
            >
              {selectedPart.label}
            </text>
            <text
              x={calloutX + 14}
              y={calloutY + 61}
              fill="#6a6a6a"
              fontFamily="Consolas, monospace"
              fontSize="10"
              letterSpacing="1.1"
            >
              {selectedPart.type.toUpperCase()} / X {Math.round(selectedPart.frame.position.x)} / Y{" "}
              {Math.round(selectedPart.frame.position.y)}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
};
