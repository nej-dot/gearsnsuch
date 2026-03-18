import {
  add,
  angleOf,
  clamp,
  dot,
  length,
  midpoint,
  normalize,
  perpendicular,
  rotate,
  scale,
  sub,
  vec,
} from "../domain/geometry";
import { deriveGearGeometry } from "../domain/gears";
import type {
  CrankPart,
  CrankSliderConnection,
  GearPart,
  MechanismConnection,
  MechanismDocument,
  MechanismPart,
  MotorDriver,
  PartId,
  PartPose,
  RackPart,
  SimulationDiagnostic,
  SimulationFrame,
  SliderPart,
} from "../domain/mechanism";
import { motionKey } from "../domain/mechanism";

interface MotionEdge {
  from: string;
  to: string;
  factor: number;
  connectionId: string;
}

const MOTION_TOLERANCE = 1e-4;

const isGear = (part: MechanismPart): part is GearPart => part.type === "gear";
const isRack = (part: MechanismPart): part is RackPart => part.type === "rack";
const isSlider = (part: MechanismPart): part is SliderPart => part.type === "slider";
const isCrank = (part: MechanismPart): part is CrankPart => part.type === "crank";

const getPartMap = (document: MechanismDocument): Map<PartId, MechanismPart> =>
  new Map(document.parts.map((part) => [part.id, part]));

const pushDiagnostic = (
  diagnostics: SimulationDiagnostic[],
  diagnostic: SimulationDiagnostic,
): void => {
  const exists = diagnostics.some(
    (entry) =>
      entry.message === diagnostic.message &&
      entry.connectionId === diagnostic.connectionId,
  );

  if (!exists) {
    diagnostics.push(diagnostic);
  }
};

const driverValueAtTime = (driver: MotorDriver, time: number): number => {
  if (driver.mode === "position") {
    return driver.value;
  }

  return (driver.phase ?? 0) + driver.value * time;
};

const validateConnections = (
  document: MechanismDocument,
  diagnostics: SimulationDiagnostic[],
): void => {
  const partMap = getPartMap(document);

  document.connections.forEach((connection) => {
    if (connection.type === "gearMesh") {
      const gearA = partMap.get(connection.gearAId);
      const gearB = partMap.get(connection.gearBId);

      if (!gearA || !gearB || !isGear(gearA) || !isGear(gearB)) {
        return;
      }

      const geometryA = deriveGearGeometry(gearA.params);
      const geometryB = deriveGearGeometry(gearB.params);
      const moduleDelta = Math.abs(geometryA.module - geometryB.module);
      const pressureDelta = Math.abs(
        geometryA.pressureAngleDeg - geometryB.pressureAngleDeg,
      );
      const expectedCenterDistance = geometryA.pitchRadius + geometryB.pitchRadius;
      const actualCenterDistance = length(
        sub(gearB.frame.position, gearA.frame.position),
      );

      if (moduleDelta > 0.02) {
        pushDiagnostic(diagnostics, {
          severity: "error",
          message:
            "Meshed gears need the same module or their tooth spacing will not line up visually.",
          connectionId: connection.id,
          partIds: [gearA.id, gearB.id],
        });
      }

      if (pressureDelta > 0.1) {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          message:
            "Meshed gears should share the same pressure angle for a believable tooth profile.",
          connectionId: connection.id,
          partIds: [gearA.id, gearB.id],
        });
      }

      if (Math.abs(actualCenterDistance - expectedCenterDistance) > geometryA.module * 0.35) {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          message:
            "Gear centers are not at the pitch-circle distance, so the rendered teeth will not appear to mesh correctly.",
          connectionId: connection.id,
          partIds: [gearA.id, gearB.id],
        });
      }
    }

    if (connection.type === "rackPinion") {
      const pinion = partMap.get(connection.pinionId);
      const rack = partMap.get(connection.rackId);

      if (!pinion || !rack || !isGear(pinion) || !isRack(rack)) {
        return;
      }

      const gearGeometry = deriveGearGeometry(pinion.params);

      if (Math.abs(rack.params.toothPitch - gearGeometry.circularPitch) > gearGeometry.module * 0.4) {
        pushDiagnostic(diagnostics, {
          severity: "warning",
          message:
            "Rack tooth pitch does not match the pinion circular pitch, so the fake mesh will drift visually.",
          connectionId: connection.id,
          partIds: [pinion.id, rack.id],
        });
      }
    }
  });
};

const buildMotionEdges = (document: MechanismDocument): MotionEdge[] => {
  const partMap = getPartMap(document);
  const edges: MotionEdge[] = [];

  const connectBidirectional = (
    a: string,
    b: string,
    factorAB: number,
    factorBA: number,
    connectionId: string,
  ): void => {
    edges.push({
      from: a,
      to: b,
      factor: factorAB,
      connectionId,
    });
    edges.push({
      from: b,
      to: a,
      factor: factorBA,
      connectionId,
    });
  };

  document.connections.forEach((connection) => {
    switch (connection.type) {
      case "gearMesh": {
        const gearA = partMap.get(connection.gearAId);
        const gearB = partMap.get(connection.gearBId);

        if (!gearA || !gearB || !isGear(gearA) || !isGear(gearB)) {
          return;
        }

        connectBidirectional(
          motionKey(gearA.id, "rotation"),
          motionKey(gearB.id, "rotation"),
          -(gearA.params.teeth / gearB.params.teeth),
          -(gearB.params.teeth / gearA.params.teeth),
          connection.id,
        );
        break;
      }

      case "rackPinion": {
        const pinion = partMap.get(connection.pinionId);
        const rack = partMap.get(connection.rackId);

        if (!pinion || !rack || !isGear(pinion) || !isRack(rack)) {
          return;
        }

        const direction = connection.direction ?? 1;
        const translationPerRadian = deriveGearGeometry(pinion.params).pitchRadius * direction;

        connectBidirectional(
          motionKey(pinion.id, "rotation"),
          motionKey(rack.id, "translation"),
          translationPerRadian,
          1 / translationPerRadian,
          connection.id,
        );
        break;
      }

      case "coaxial": {
        const ratio = (connection.ratio ?? 1) * (connection.invert ? -1 : 1);
        connectBidirectional(
          motionKey(connection.partAId, "rotation"),
          motionKey(connection.partBId, "rotation"),
          ratio,
          1 / ratio,
          connection.id,
        );
        break;
      }

      case "crankSlider":
        break;
    }
  });

  return edges;
};

const propagateMotion = (
  edges: MotionEdge[],
  seedValues: Map<string, number>,
  diagnostics: SimulationDiagnostic[],
): Map<string, number> => {
  const queue = [...seedValues.keys()];
  const adjacency = new Map<string, MotionEdge[]>();

  edges.forEach((edge) => {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge);
    adjacency.set(edge.from, list);
  });

  while (queue.length > 0) {
    const currentKey = queue.shift()!;
    const currentValue = seedValues.get(currentKey);

    if (currentValue === undefined) {
      continue;
    }

    const outgoing = adjacency.get(currentKey) ?? [];

    outgoing.forEach((edge) => {
      const nextValue = currentValue * edge.factor;
      const existingValue = seedValues.get(edge.to);

      if (existingValue === undefined) {
        seedValues.set(edge.to, nextValue);
        queue.push(edge.to);
        return;
      }

      if (Math.abs(existingValue - nextValue) > MOTION_TOLERANCE) {
        pushDiagnostic(diagnostics, {
          severity: "error",
          message:
            "Contradictory motion graph: the same motion channel was solved to two different values.",
          connectionId: edge.connectionId,
        });
      }
    });
  }

  return seedValues;
};

const createDefaultPose = (part: MechanismPart): PartPose => ({
  position: part.frame.position,
  rotation: part.frame.rotation,
  translation: 0,
  anchors: {},
});

const initializePoses = (
  document: MechanismDocument,
  channels: Map<string, number>,
): Record<PartId, PartPose> => {
  const poses: Record<PartId, PartPose> = {};

  document.parts.forEach((part) => {
    const pose = createDefaultPose(part);
    const rotation = channels.get(motionKey(part.id, "rotation"));
    const translation = channels.get(motionKey(part.id, "translation")) ?? 0;

    if (rotation !== undefined) {
      pose.rotation = rotation;
    }

    if (part.type === "rack") {
      const axis = normalize(part.params.axis);
      pose.position = add(part.frame.position, scale(axis, translation));
      pose.rotation = angleOf(axis);
      pose.translation = translation;
      poses[part.id] = pose;
      return;
    }

    if (part.type === "slider") {
      const axis = normalize(part.params.axis);
      pose.position = add(part.frame.position, scale(axis, translation));
      pose.rotation = angleOf(axis);
      pose.translation = translation;
      pose.anchors.pin = pose.position;
      poses[part.id] = pose;
      return;
    }

    if (part.type === "gear") {
      pose.anchors.center = pose.position;
    }

    if (part.type === "pivot") {
      pose.anchors.center = pose.position;
    }

    if (part.type === "crank") {
      pose.anchors.pivot = pose.position;
      pose.anchors.pin = add(
        pose.position,
        rotate(vec(part.params.radius, 0), pose.rotation),
      );
    }

    if (part.type === "rod") {
      pose.anchors.a = add(pose.position, vec(-part.params.length / 2, 0));
      pose.anchors.b = add(pose.position, vec(part.params.length / 2, 0));
    }

    poses[part.id] = pose;
  });

  return poses;
};

const resolveCrankSlider = (
  document: MechanismDocument,
  connection: CrankSliderConnection,
  poses: Record<PartId, PartPose>,
  channels: Map<string, number>,
  diagnostics: SimulationDiagnostic[],
): void => {
  const partMap = getPartMap(document);
  const crank = partMap.get(connection.crankId);
  const slider = partMap.get(connection.sliderId);
  const rod = partMap.get(connection.rodId);

  if (!crank || !slider || !rod || !isCrank(crank) || !isSlider(slider) || rod.type !== "rod") {
    return;
  }

  const crankPose = poses[crank.id];
  const crankPin = crankPose.anchors.pin;

  if (!crankPin) {
    return;
  }

  const sliderAxis = normalize(slider.params.axis);
  const sliderNormal = perpendicular(sliderAxis);
  const sliderOrigin = slider.frame.position;
  const relativePin = sub(crankPin, sliderOrigin);
  const along = dot(relativePin, sliderAxis);
  const across = dot(relativePin, sliderNormal);
  const rodLength = rod.params.length;

  if (Math.abs(across) > rodLength) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      message:
        "Crank-slider linkage is geometrically impossible because the rod cannot reach the slider track.",
      connectionId: connection.id,
      partIds: [crank.id, slider.id, rod.id],
    });
    return;
  }

  const root = Math.sqrt(Math.max(0, rodLength * rodLength - across * across));
  const branchSign = connection.branch === "negative" ? -1 : 1;
  const rawTranslation = along + branchSign * root;
  const clampedTranslation = clamp(
    rawTranslation,
    slider.params.travelMin,
    slider.params.travelMax,
  );

  if (Math.abs(rawTranslation - clampedTranslation) > MOTION_TOLERANCE) {
    pushDiagnostic(diagnostics, {
      severity: "warning",
      message:
        "Slider travel clamp was hit. This layout would jam in a real mechanism.",
      connectionId: connection.id,
      partIds: [slider.id],
    });
  }

  const channelKey = motionKey(slider.id, "translation");
  const existingTranslation = channels.get(channelKey);

  if (
    existingTranslation !== undefined &&
    Math.abs(existingTranslation - clampedTranslation) > MOTION_TOLERANCE
  ) {
    pushDiagnostic(diagnostics, {
      severity: "error",
      message:
        "Contradictory linkage: slider already has a conflicting translation value.",
      connectionId: connection.id,
      partIds: [slider.id, crank.id],
    });
    return;
  }

  channels.set(channelKey, clampedTranslation);

  const sliderPosition = add(sliderOrigin, scale(sliderAxis, clampedTranslation));
  poses[slider.id] = {
    position: sliderPosition,
    rotation: angleOf(sliderAxis),
    translation: clampedTranslation,
    anchors: {
      pin: sliderPosition,
    },
  };

  const rodVector = sub(sliderPosition, crankPin);
  const rodDistance = length(rodVector);

  if (Math.abs(rodDistance - rod.params.length) > 0.75) {
    pushDiagnostic(diagnostics, {
      severity: "warning",
      message:
        "Rod length mismatch after solving. Check the linkage dimensions or branch selection.",
      connectionId: connection.id,
      partIds: [rod.id],
    });
  }

  poses[rod.id] = {
    position: midpoint(crankPin, sliderPosition),
    rotation: angleOf(rodVector),
    translation: 0,
    anchors: {
      a: crankPin,
      b: sliderPosition,
    },
  };
};

export const simulateMechanism = (
  document: MechanismDocument,
  time: number,
): SimulationFrame => {
  const diagnostics: SimulationDiagnostic[] = [];
  const channels = new Map<string, number>();

  validateConnections(document, diagnostics);

  document.drivers.forEach((driver) => {
    if (!driver.enabled) {
      return;
    }

    channels.set(
      motionKey(driver.targetPartId, driver.channel),
      driverValueAtTime(driver, time),
    );
  });

  const propagatedChannels = propagateMotion(buildMotionEdges(document), channels, diagnostics);
  const poses = initializePoses(document, propagatedChannels);

  document.connections.forEach((connection: MechanismConnection) => {
    if (connection.type === "crankSlider") {
      resolveCrankSlider(document, connection, poses, propagatedChannels, diagnostics);
    }
  });

  return {
    time,
    poses,
    channels: Object.fromEntries(propagatedChannels.entries()),
    diagnostics,
  };
};
