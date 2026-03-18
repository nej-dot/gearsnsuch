import { useMemo, useState } from "react";
import { formatNumber, vec } from "./domain/geometry";
import { deriveGearGeometry, deriveRackGeometry } from "./domain/gears";
import type { MechanismDocument, MechanismPart } from "./domain/mechanism";
import { createDemoMechanism } from "./engine/demo";
import { simulateMechanism } from "./engine/solver";
import { usePlayback } from "./editor/usePlayback";
import { MechanismViewport } from "./renderer/MechanismViewport";
import { parseMechanism, serializeMechanism } from "./serialization/json";

const updatePart = (
  document: MechanismDocument,
  partId: string,
  updater: (part: MechanismPart) => MechanismPart,
): MechanismDocument => ({
  ...document,
  parts: document.parts.map((part) => (part.id === partId ? updater(part) : part)),
});

const numberValue = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

type PartKind = MechanismPart["type"];

const nextPartId = (document: MechanismDocument, kind: PartKind): string => {
  const count = document.parts.filter((part) => part.type === kind).length + 1;
  return `${kind}-${count}`;
};

const createPart = (document: MechanismDocument, kind: PartKind): MechanismPart => {
  const offset = document.parts.length * 18;
  const position = vec(520 + offset, 180 + (offset % 160));
  const id = nextPartId(document, kind);
  const style = {
    stroke: "#171612",
  };

  switch (kind) {
    case "gear":
      return {
        id,
        type: "gear",
        label: `Gear ${document.parts.filter((part) => part.type === "gear").length + 1}`,
        frame: { position, rotation: 0 },
        params: { teeth: 24, module: 4, pressureAngleDeg: 20, boreRadius: 10 },
        style,
      };
    case "rack":
      return {
        id,
        type: "rack",
        label: `Rack ${document.parts.filter((part) => part.type === "rack").length + 1}`,
        frame: { position, rotation: 0 },
        params: {
          length: 240,
          height: 30,
          axis: vec(1, 0),
          toothPitch: Math.PI * 4,
          module: 4,
          pressureAngleDeg: 20,
        },
        style,
      };
    case "pivot":
      return {
        id,
        type: "pivot",
        label: `Pivot ${document.parts.filter((part) => part.type === "pivot").length + 1}`,
        frame: { position, rotation: 0 },
        params: { displayRadius: 14 },
        style,
      };
    case "crank":
      return {
        id,
        type: "crank",
        label: `Crank ${document.parts.filter((part) => part.type === "crank").length + 1}`,
        frame: { position, rotation: 0 },
        params: { radius: 72 },
        style,
      };
    case "slider":
      return {
        id,
        type: "slider",
        label: `Slider ${document.parts.filter((part) => part.type === "slider").length + 1}`,
        frame: { position, rotation: 0 },
        params: {
          axis: vec(1, 0),
          travelMin: -120,
          travelMax: 120,
          width: 74,
          height: 44,
        },
        style,
      };
    case "rod":
      return {
        id,
        type: "rod",
        label: `Rod ${document.parts.filter((part) => part.type === "rod").length + 1}`,
        frame: { position, rotation: 0 },
        params: { length: 180, thickness: 18 },
        style,
      };
  }

  throw new Error(`Unsupported part kind: ${kind}`);
};

const App = () => {
  const [document, setDocument] = useState<MechanismDocument>(() => createDemoMechanism());
  const [selectedPartId, setSelectedPartId] = useState<string | null>("gear-driver");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [leftRailOpen, setLeftRailOpen] = useState(false);
  const [rightRailOpen, setRightRailOpen] = useState(false);
  const playback = usePlayback();

  const frame = useMemo(
    () => simulateMechanism(document, playback.time),
    [document, playback.time],
  );

  const selectedPart = useMemo(
    () => document.parts.find((part) => part.id === selectedPartId) ?? null,
    [document.parts, selectedPartId],
  );
  const selectedGearGeometry =
    selectedPart?.type === "gear" ? deriveGearGeometry(selectedPart.params) : null;
  const selectedRackGeometry =
    selectedPart?.type === "rack" ? deriveRackGeometry(selectedPart.params) : null;
  const enabledDriverCount = useMemo(
    () => document.drivers.filter((driver) => driver.enabled).length,
    [document.drivers],
  );
  const sheetStatus = frame.diagnostics.some((diagnostic) => diagnostic.severity === "error")
    ? "Needs review"
    : playback.isPlaying
      ? "Dynamic pass"
      : "Draft ready";
  const issuedDate = useMemo(
    () =>
      new Intl.DateTimeFormat("sv-SE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  );

  const exportJson = () => {
    setJsonError(null);
    setJsonText(serializeMechanism(document));
  };

  const importJson = () => {
    try {
      const nextDocument = parseMechanism(jsonText);
      setDocument(nextDocument);
      setSelectedPartId(nextDocument.parts[0]?.id ?? null);
      playback.reset();
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "Unable to parse JSON.");
    }
  };

  const addPart = (kind: PartKind) => {
    const part = createPart(document, kind);
    setDocument({
      ...document,
      parts: [...document.parts, part],
    });
    setSelectedPartId(part.id);
    playback.setIsPlaying(false);
    setRightRailOpen(true);
  };

  const handleSelectPart = (partId: string | null) => {
    setSelectedPartId(partId);

    if (partId) {
      setRightRailOpen(true);
    }
  };

  return (
    <div className="app-shell">
      <div className="canvas-shell">
        <div className="canvas-overlay canvas-overlay-left">
          <div className="floating-chip floating-chip-brand">
            <p className="eyebrow">Interactive assembly study</p>
            <h1>Gears n Such</h1>
            <p className="hero-copy">{document.metadata.name}</p>
          </div>
        </div>

        <div className="canvas-overlay canvas-overlay-right">
          <div className="toolbar overlay-toolbar">
            <button className="secondary" onClick={() => setLeftRailOpen(!leftRailOpen)}>
              {leftRailOpen ? "Hide library" : "Library"}
            </button>
            <button className="secondary" onClick={() => setRightRailOpen(!rightRailOpen)}>
              {rightRailOpen ? "Hide inspector" : "Inspector"}
            </button>
            <button onClick={() => playback.setIsPlaying(!playback.isPlaying)}>
              {playback.isPlaying ? "Pause cycle" : "Run cycle"}
            </button>
            <button
              className="secondary"
              onClick={() => {
                playback.reset();
                playback.setIsPlaying(false);
              }}
            >
              Zero time
            </button>
            <button
              className="secondary"
              onClick={() => {
                setDocument(createDemoMechanism());
                setSelectedPartId("gear-driver");
                playback.reset();
              }}
            >
              Reload study
            </button>
          </div>
        </div>

        <div className="canvas-overlay canvas-overlay-bottom">
          <div className="floating-chip floating-chip-status">
            <span>Status {sheetStatus}</span>
            <span>Time {formatNumber(frame.time)} s</span>
            <span>Parts {document.parts.length}</span>
            <span>Diagnostics {frame.diagnostics.length}</span>
          </div>
        </div>

        <button
          className={`drawer-handle drawer-handle-left ${leftRailOpen ? "open" : ""}`}
          onClick={() => setLeftRailOpen(!leftRailOpen)}
        >
          {leftRailOpen ? "Close library" : "Open library"}
        </button>

        <button
          className={`drawer-handle drawer-handle-right ${rightRailOpen ? "open" : ""}`}
          onClick={() => setRightRailOpen(!rightRailOpen)}
        >
          {rightRailOpen ? "Close inspector" : "Open inspector"}
        </button>

        <main className="main-stage">
          <MechanismViewport
            document={document}
            frame={frame}
            selectedPartId={selectedPartId}
            isPaused={!playback.isPlaying}
            onSelectPart={handleSelectPart}
            onMovePart={(partId, x, y) => {
              setDocument(
                updatePart(document, partId, (part) => ({
                  ...part,
                  frame: {
                    ...part.frame,
                    position: { x, y },
                  },
                })),
              );
            }}
          />
        </main>

        <aside className={`slide-panel slide-panel-left ${leftRailOpen ? "open" : ""}`}>
          <div className="slide-panel-header">
            <div>
              <p className="eyebrow">Library</p>
              <h2>Part Library</h2>
            </div>
            <button className="secondary" onClick={() => setLeftRailOpen(false)}>
              Close
            </button>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>New Geometry</h2>
              <span>Add parts</span>
            </div>
            <p className="panel-copy">
              Pause the cycle before repositioning. New parts land near the center of the canvas.
            </p>
            <div className="tool-grid">
              {(["gear", "rack", "pivot", "crank", "slider", "rod"] as PartKind[]).map((kind) => (
                <button key={kind} className="tool-button" onClick={() => addPart(kind)}>
                  {kind}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Part Register</h2>
              <span>{document.parts.length}</span>
            </div>
            <div className="part-list">
              {document.parts.map((part) => (
                <button
                  key={part.id}
                  className={`part-pill ${part.id === selectedPartId ? "active" : ""}`}
                  onClick={() => {
                    handleSelectPart(part.id);
                    setLeftRailOpen(false);
                  }}
                >
                  <span>{part.label}</span>
                  <small>{part.type}</small>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <aside className={`slide-panel slide-panel-right ${rightRailOpen ? "open" : ""}`}>
          <div className="slide-panel-header">
            <div>
              <p className="eyebrow">Inspector</p>
              <h2>Selected Spec</h2>
            </div>
            <button className="secondary" onClick={() => setRightRailOpen(false)}>
              Close
            </button>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Session</h2>
              <span>{sheetStatus}</span>
            </div>
            <label className="range-row">
              <span>Playback speed</span>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={playback.speed}
                onChange={(event) => playback.setSpeed(numberValue(event.target.value))}
              />
              <strong>{formatNumber(playback.speed)}x</strong>
            </label>
            <div className="panel-stat-grid">
              <div className="stat-row inspector-stat">
                <span>Issued</span>
                <strong>{issuedDate}</strong>
              </div>
              <div className="stat-row inspector-stat">
                <span>Motion</span>
                <strong>{Object.keys(frame.channels).length} channels</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Selected Spec</h2>
              {selectedPart ? <span>{selectedPart.type}</span> : <span>Awaiting target</span>}
            </div>
            {selectedPart ? (
              <div className="inspector-grid">
                  <label className="field-span-2">
                    <span>Label</span>
                    <input
                      value={selectedPart.label}
                      onChange={(event) =>
                        setDocument(
                          updatePart(document, selectedPart.id, (part) => ({
                            ...part,
                            label: event.target.value,
                          })),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>X position</span>
                    <input
                      type="number"
                      value={selectedPart.frame.position.x}
                      onChange={(event) =>
                        setDocument(
                          updatePart(document, selectedPart.id, (part) => ({
                            ...part,
                            frame: {
                              ...part.frame,
                              position: {
                                ...part.frame.position,
                                x: numberValue(event.target.value),
                              },
                            },
                          })),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Y position</span>
                    <input
                      type="number"
                      value={selectedPart.frame.position.y}
                      onChange={(event) =>
                        setDocument(
                          updatePart(document, selectedPart.id, (part) => ({
                            ...part,
                            frame: {
                              ...part.frame,
                              position: {
                                ...part.frame.position,
                                y: numberValue(event.target.value),
                              },
                            },
                          })),
                        )
                      }
                    />
                  </label>
                  {selectedPart.type === "gear" ? (
                    <>
                      <label>
                        <span>Teeth</span>
                        <input
                          type="number"
                          value={selectedPart.params.teeth}
                          onChange={(event) =>
                            setDocument(
                              updatePart(document, selectedPart.id, (part) =>
                                part.type !== "gear"
                                  ? part
                                  : {
                                      ...part,
                                      params: {
                                        ...part.params,
                                        teeth: Math.max(
                                          6,
                                          Math.round(numberValue(event.target.value)),
                                        ),
                                      },
                                    },
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Module</span>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedPart.params.module ?? selectedGearGeometry?.module ?? 4}
                          onChange={(event) =>
                            setDocument(
                              updatePart(document, selectedPart.id, (part) =>
                                part.type !== "gear"
                                  ? part
                                  : {
                                      ...part,
                                      params: {
                                        ...part.params,
                                        module: Math.max(0.5, numberValue(event.target.value)),
                                      },
                                    },
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field-span-2">
                        <span>Pressure angle</span>
                        <input
                          type="number"
                          step="0.5"
                          value={
                            selectedPart.params.pressureAngleDeg ??
                            selectedGearGeometry?.pressureAngleDeg ??
                            20
                          }
                          onChange={(event) =>
                            setDocument(
                              updatePart(document, selectedPart.id, (part) =>
                                part.type !== "gear"
                                  ? part
                                  : {
                                      ...part,
                                      params: {
                                        ...part.params,
                                        pressureAngleDeg: Math.max(
                                          14.5,
                                          numberValue(event.target.value),
                                        ),
                                      },
                                    },
                              ),
                            )
                          }
                        />
                      </label>
                      <div className="stat-row inspector-stat">
                        <span>Pitch radius</span>
                        <strong>{formatNumber(selectedGearGeometry?.pitchRadius ?? 0)}</strong>
                      </div>
                      <div className="stat-row inspector-stat">
                        <span>Circular pitch</span>
                        <strong>{formatNumber(selectedGearGeometry?.circularPitch ?? 0)}</strong>
                      </div>
                    </>
                  ) : null}
                  {selectedPart.type === "rack" ? (
                    <>
                      <label>
                        <span>Length</span>
                        <input
                          type="number"
                          value={selectedPart.params.length}
                          onChange={(event) =>
                            setDocument(
                              updatePart(document, selectedPart.id, (part) =>
                                part.type !== "rack"
                                  ? part
                                  : {
                                      ...part,
                                      params: {
                                        ...part.params,
                                        length: Math.max(40, numberValue(event.target.value)),
                                      },
                                    },
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        <span>Module</span>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedPart.params.module ?? selectedRackGeometry?.module ?? 4}
                          onChange={(event) =>
                            setDocument(
                              updatePart(document, selectedPart.id, (part) =>
                                part.type !== "rack"
                                  ? part
                                  : {
                                      ...part,
                                      params: {
                                        ...part.params,
                                        module: Math.max(0.5, numberValue(event.target.value)),
                                        toothPitch:
                                          Math.PI * Math.max(0.5, numberValue(event.target.value)),
                                      },
                                    },
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field-span-2">
                        <span>Pressure angle</span>
                        <input
                          type="number"
                          step="0.5"
                          value={
                            selectedPart.params.pressureAngleDeg ??
                            selectedRackGeometry?.pressureAngleDeg ??
                            20
                          }
                          onChange={(event) =>
                            setDocument(
                              updatePart(document, selectedPart.id, (part) =>
                                part.type !== "rack"
                                  ? part
                                  : {
                                      ...part,
                                      params: {
                                        ...part.params,
                                        pressureAngleDeg: Math.max(
                                          14.5,
                                          numberValue(event.target.value),
                                        ),
                                      },
                                    },
                              ),
                            )
                          }
                        />
                      </label>
                      <div className="stat-row inspector-stat">
                        <span>Tooth pitch</span>
                        <strong>{formatNumber(selectedRackGeometry?.toothPitch ?? 0)}</strong>
                      </div>
                    </>
                  ) : null}
                  {selectedPart.type === "crank" ? (
                    <label className="field-span-2">
                      <span>Radius</span>
                      <input
                        type="number"
                        value={selectedPart.params.radius}
                        onChange={(event) =>
                          setDocument(
                            updatePart(document, selectedPart.id, (part) =>
                              part.type !== "crank"
                                ? part
                                : {
                                    ...part,
                                    params: {
                                      ...part.params,
                                      radius: Math.max(8, numberValue(event.target.value)),
                                    },
                                  },
                            ),
                          )
                        }
                      />
                    </label>
                  ) : null}
                  {selectedPart.type === "rod" ? (
                    <label className="field-span-2">
                      <span>Length</span>
                      <input
                        type="number"
                        value={selectedPart.params.length}
                        onChange={(event) =>
                          setDocument(
                            updatePart(document, selectedPart.id, (part) =>
                              part.type !== "rod"
                                ? part
                                : {
                                    ...part,
                                    params: {
                                      ...part.params,
                                      length: Math.max(20, numberValue(event.target.value)),
                                    },
                                  },
                            ),
                          )
                        }
                      />
                    </label>
                  ) : null}
              </div>
            ) : (
              <p className="empty-copy">Select a part to expose its editable dimensions and notes.</p>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Drive Inputs</h2>
              <span>{enabledDriverCount} active</span>
            </div>
            <div className="driver-list">
              {document.drivers.map((driver) => (
                <label key={driver.id}>
                  <span>{driver.label}</span>
                  <input
                    type="number"
                    step="0.1"
                    value={driver.value}
                    onChange={(event) =>
                      setDocument({
                        ...document,
                        drivers: document.drivers.map((entry) =>
                          entry.id !== driver.id
                            ? entry
                            : {
                                ...entry,
                                value: numberValue(event.target.value),
                              },
                        ),
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Integrity Notes</h2>
              <span>{frame.diagnostics.length}</span>
            </div>
            {frame.diagnostics.length === 0 ? (
              <p className="empty-copy">No contradictions detected in the current kinematic graph.</p>
            ) : (
              <div className="diagnostic-list">
                {frame.diagnostics.map((diagnostic, index) => (
                  <div
                    key={`${diagnostic.message}-${index}`}
                    className={`diagnostic ${diagnostic.severity}`}
                  >
                    <strong>{diagnostic.severity}</strong>
                    <p>{diagnostic.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Data Exchange</h2>
              <span>JSON</span>
            </div>
            <div className="toolbar">
              <button className="secondary" onClick={exportJson}>
                Export
              </button>
              <button className="secondary" onClick={importJson}>
                Import
              </button>
            </div>
            <textarea
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              placeholder="Exported JSON appears here, or paste a document to import."
            />
            {jsonError ? <p className="error-copy">{jsonError}</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default App;
