import { vec, type Vec2 } from "./geometry";
import type { GearPart, MechanismDocument, RackPart } from "./mechanism";

export interface DerivedGearGeometry {
  teeth: number;
  module: number;
  pressureAngleDeg: number;
  pressureAngleRad: number;
  pitchRadius: number;
  baseRadius: number;
  outerRadius: number;
  rootRadius: number;
  boreRadius: number;
  circularPitch: number;
  toothAngle: number;
  halfToothAngle: number;
}

export interface DerivedRackGeometry {
  module: number;
  pressureAngleDeg: number;
  pressureAngleRad: number;
  toothPitch: number;
  addendum: number;
  dedendum: number;
  toothTopWidth: number;
  toothRootWidth: number;
}

const DEFAULT_MODULE = 4;
const DEFAULT_PRESSURE_ANGLE_DEG = 20;

const polar = (radius: number, angle: number): Vec2 =>
  vec(Math.cos(angle) * radius, Math.sin(angle) * radius);

const pointToString = (point: Vec2): string => `${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

const arcPoints = (
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): Vec2[] => {
  const points: Vec2[] = [];

  for (let index = 1; index <= segments; index += 1) {
    const t = index / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    points.push(polar(radius, angle));
  }

  return points;
};

const involuteParameterForRadius = (baseRadius: number, radius: number): number => {
  if (radius <= baseRadius) {
    return 0;
  }

  return Math.sqrt((radius * radius) / (baseRadius * baseRadius) - 1);
};

const involuteAngleForRadius = (baseRadius: number, radius: number): number => {
  const parameter = involuteParameterForRadius(baseRadius, radius);
  return parameter - Math.atan(parameter);
};

export const deriveGearGeometry = (params: GearPart["params"]): DerivedGearGeometry => {
  const teeth = Math.max(6, Math.round(params.teeth));
  const module =
    params.module && params.module > 0
      ? params.module
      : params.radius && params.radius > 0
        ? (params.radius * 2) / teeth
        : DEFAULT_MODULE;
  const pressureAngleDeg = params.pressureAngleDeg ?? DEFAULT_PRESSURE_ANGLE_DEG;
  const pressureAngleRad = (pressureAngleDeg * Math.PI) / 180;
  const pitchRadius = (module * teeth) / 2;
  const baseRadius = pitchRadius * Math.cos(pressureAngleRad);
  const outerRadius = pitchRadius + module;
  const rootRadius = Math.max(module * 0.6, pitchRadius - 1.25 * module);
  const circularPitch = Math.PI * module;
  const toothAngle = (Math.PI * 2) / teeth;
  const halfToothAngle = toothAngle / 4;

  return {
    teeth,
    module,
    pressureAngleDeg,
    pressureAngleRad,
    pitchRadius,
    baseRadius,
    outerRadius,
    rootRadius,
    boreRadius: params.boreRadius,
    circularPitch,
    toothAngle,
    halfToothAngle,
  };
};

export const deriveRackGeometry = (params: RackPart["params"]): DerivedRackGeometry => {
  const module =
    params.module && params.module > 0
      ? params.module
      : params.toothPitch > 0
        ? params.toothPitch / Math.PI
        : DEFAULT_MODULE;
  const pressureAngleDeg = params.pressureAngleDeg ?? DEFAULT_PRESSURE_ANGLE_DEG;
  const pressureAngleRad = (pressureAngleDeg * Math.PI) / 180;
  const toothPitch = params.toothPitch > 0 ? params.toothPitch : Math.PI * module;
  const addendum = module;
  const dedendum = 1.25 * module;
  const heightDelta = addendum + dedendum;
  const flankOffset = heightDelta * Math.tan(pressureAngleRad);
  const toothTopWidth = Math.max(module * 0.45, toothPitch / 2 - flankOffset);
  const toothRootWidth = toothTopWidth + flankOffset * 2;

  return {
    module,
    pressureAngleDeg,
    pressureAngleRad,
    toothPitch,
    addendum,
    dedendum,
    toothTopWidth,
    toothRootWidth,
  };
};

export const buildInvoluteGearPath = (
  geometry: DerivedGearGeometry,
  involuteSamples = 7,
): string => {
  const startRadius = Math.max(geometry.baseRadius, geometry.rootRadius);
  const pitchInvoluteAngle = involuteAngleForRadius(geometry.baseRadius, geometry.pitchRadius);
  const points: Vec2[] = [];

  const flankAngleAtRadius = (radius: number): number => {
    const involuteAngle = involuteAngleForRadius(geometry.baseRadius, radius);
    return geometry.halfToothAngle + pitchInvoluteAngle - involuteAngle;
  };

  const rightFlankPoint = (centerAngle: number, radius: number): Vec2 =>
    polar(radius, centerAngle + flankAngleAtRadius(radius));

  const leftFlankPoint = (centerAngle: number, radius: number): Vec2 =>
    polar(radius, centerAngle - flankAngleAtRadius(radius));

  for (let toothIndex = 0; toothIndex < geometry.teeth; toothIndex += 1) {
    const centerAngle = toothIndex * geometry.toothAngle;
    const nextCenterAngle = (toothIndex + 1) * geometry.toothAngle;
    const rightStartAngle = centerAngle + flankAngleAtRadius(startRadius);
    const leftStartAngle = centerAngle - flankAngleAtRadius(startRadius);
    const nextRightStartAngle = nextCenterAngle + flankAngleAtRadius(startRadius);
    const tipRightAngle = centerAngle + flankAngleAtRadius(geometry.outerRadius);
    const tipLeftAngle = centerAngle - flankAngleAtRadius(geometry.outerRadius);
    const rightRootPoint = polar(geometry.rootRadius, rightStartAngle);
    const leftRootPoint = polar(geometry.rootRadius, leftStartAngle);

    if (toothIndex === 0) {
      points.push(rightRootPoint);
    }

    if (geometry.rootRadius < startRadius) {
      points.push(rightFlankPoint(centerAngle, startRadius));
    }

    for (let index = 0; index <= involuteSamples; index += 1) {
      const t = index / involuteSamples;
      const radius = startRadius + (geometry.outerRadius - startRadius) * t;
      points.push(rightFlankPoint(centerAngle, radius));
    }

    points.push(...arcPoints(geometry.outerRadius, tipRightAngle, tipLeftAngle, 5));

    for (let index = involuteSamples; index >= 0; index -= 1) {
      const t = index / involuteSamples;
      const radius = startRadius + (geometry.outerRadius - startRadius) * t;
      points.push(leftFlankPoint(centerAngle, radius));
    }

    if (geometry.rootRadius < startRadius) {
      points.push(leftRootPoint);
    }

    points.push(...arcPoints(geometry.rootRadius, leftStartAngle, nextRightStartAngle, 4));
  }

  if (points.length === 0) {
    return "";
  }

  return `M ${pointToString(points[0])} ${points
    .slice(1)
    .map((point) => `L ${pointToString(point)}`)
    .join(" ")} Z`;
};

const normalizePeriodicAngle = (angle: number, period: number): number => {
  let value = angle % period;

  if (value < 0) {
    value += period;
  }

  return value;
};

export const computeVisualGearPhases = (
  document: MechanismDocument,
): Record<string, number> => {
  const partMap = new Map(document.parts.map((part) => [part.id, part]));
  const phases = new Map<string, number>();

  document.connections.forEach((connection) => {
    if (connection.type !== "gearMesh") {
      return;
    }

    const gearA = partMap.get(connection.gearAId);
    const gearB = partMap.get(connection.gearBId);

    if (!gearA || !gearB || gearA.type !== "gear" || gearB.type !== "gear") {
      return;
    }

    const geometryA = deriveGearGeometry(gearA.params);
    const geometryB = deriveGearGeometry(gearB.params);
    const angleAToB = Math.atan2(
      gearB.frame.position.y - gearA.frame.position.y,
      gearB.frame.position.x - gearA.frame.position.x,
    );
    const angleBToA = angleAToB + Math.PI;

    if (!phases.has(gearA.id)) {
      phases.set(
        gearA.id,
        normalizePeriodicAngle(angleAToB, geometryA.toothAngle),
      );
    }

    if (!phases.has(gearB.id)) {
      phases.set(
        gearB.id,
        normalizePeriodicAngle(
          angleBToA - geometryB.toothAngle / 2,
          geometryB.toothAngle,
        ),
      );
    }
  });

  return Object.fromEntries(phases.entries());
};

export const buildRackPath = (
  rack: RackPart["params"],
  geometry: DerivedRackGeometry,
): string => {
  const halfLength = rack.length / 2;
  const halfHeight = rack.height / 2;
  const pitchY = -halfHeight + geometry.dedendum;
  const tipY = pitchY - geometry.addendum;
  const baseY = halfHeight;
  const toothCount = Math.max(1, Math.ceil(rack.length / geometry.toothPitch) + 2);
  const firstCenter = -halfLength - geometry.toothPitch;
  const commands: string[] = [`M ${(-halfLength).toFixed(2)} ${baseY.toFixed(2)}`];

  for (let index = 0; index < toothCount; index += 1) {
    const center = firstCenter + index * geometry.toothPitch;
    const leftRoot = center - geometry.toothRootWidth / 2;
    const leftTip = center - geometry.toothTopWidth / 2;
    const rightTip = center + geometry.toothTopWidth / 2;
    const rightRoot = center + geometry.toothRootWidth / 2;

    if (rightRoot < -halfLength || leftRoot > halfLength) {
      continue;
    }

    commands.push(`L ${leftRoot.toFixed(2)} ${pitchY.toFixed(2)}`);
    commands.push(`L ${leftTip.toFixed(2)} ${tipY.toFixed(2)}`);
    commands.push(`L ${rightTip.toFixed(2)} ${tipY.toFixed(2)}`);
    commands.push(`L ${rightRoot.toFixed(2)} ${pitchY.toFixed(2)}`);
  }

  commands.push(`L ${halfLength.toFixed(2)} ${baseY.toFixed(2)}`);
  commands.push(`L ${halfLength.toFixed(2)} ${baseY.toFixed(2)}`);
  commands.push(`L ${(-halfLength).toFixed(2)} ${baseY.toFixed(2)} Z`);

  return commands.join(" ");
};
