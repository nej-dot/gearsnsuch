import { vec, type Vec2 } from "./geometry";
import type { GearPart, MechanismDocument } from "./mechanism";

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
