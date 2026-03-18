import type { Vec2 } from "./geometry";

export type SchemaVersion = 1;
export type MotionChannel = "rotation" | "translation";
export type PartId = string;
export type ConnectionId = string;
export type DriverId = string;

export interface PartFrame {
  position: Vec2;
  rotation: number;
}

export interface PartStyle {
  fill?: string;
  stroke?: string;
}

interface BasePart<TypeName extends string, Params> {
  id: PartId;
  type: TypeName;
  label: string;
  frame: PartFrame;
  params: Params;
  style?: PartStyle;
}

export interface GearPart
  extends BasePart<
    "gear",
    {
      teeth: number;
      module?: number;
      pressureAngleDeg?: number;
      boreRadius: number;
      radius?: number;
    }
  > {}

export interface RackPart
  extends BasePart<
    "rack",
    {
      length: number;
      height: number;
      axis: Vec2;
      toothPitch: number;
    }
  > {}

export interface PivotPart
  extends BasePart<
    "pivot",
    {
      displayRadius: number;
    }
  > {}

export interface CrankPart
  extends BasePart<
    "crank",
    {
      radius: number;
    }
  > {}

export interface SliderPart
  extends BasePart<
    "slider",
    {
      axis: Vec2;
      travelMin: number;
      travelMax: number;
      width: number;
      height: number;
    }
  > {}

export interface RodPart
  extends BasePart<
    "rod",
    {
      length: number;
      thickness: number;
    }
  > {}

export type MechanismPart =
  | GearPart
  | RackPart
  | PivotPart
  | CrankPart
  | SliderPart
  | RodPart;

export interface MotorDriver {
  id: DriverId;
  label: string;
  targetPartId: PartId;
  channel: MotionChannel;
  mode: "velocity" | "position";
  value: number;
  phase?: number;
  enabled: boolean;
}

export interface GearMeshConnection {
  id: ConnectionId;
  type: "gearMesh";
  gearAId: PartId;
  gearBId: PartId;
}

export interface RackPinionConnection {
  id: ConnectionId;
  type: "rackPinion";
  pinionId: PartId;
  rackId: PartId;
  direction?: 1 | -1;
}

export interface CoaxialConnection {
  id: ConnectionId;
  type: "coaxial";
  partAId: PartId;
  partBId: PartId;
  ratio?: number;
  invert?: boolean;
}

export interface CrankSliderConnection {
  id: ConnectionId;
  type: "crankSlider";
  crankId: PartId;
  rodId: PartId;
  sliderId: PartId;
  branch?: "positive" | "negative";
}

export type MechanismConnection =
  | GearMeshConnection
  | RackPinionConnection
  | CoaxialConnection
  | CrankSliderConnection;

export interface MechanismDocument {
  schemaVersion: SchemaVersion;
  metadata: {
    name: string;
    description: string;
  };
  view: {
    width: number;
    height: number;
    grid: number;
  };
  parts: MechanismPart[];
  connections: MechanismConnection[];
  drivers: MotorDriver[];
}

export interface SimulationDiagnostic {
  severity: "warning" | "error";
  message: string;
  connectionId?: ConnectionId;
  partIds?: PartId[];
}

export interface PartPose {
  position: Vec2;
  rotation: number;
  translation: number;
  anchors: Record<string, Vec2>;
}

export interface SimulationFrame {
  time: number;
  poses: Record<PartId, PartPose>;
  channels: Record<string, number>;
  diagnostics: SimulationDiagnostic[];
}

export const motionKey = (partId: PartId, channel: MotionChannel): string =>
  `${partId}:${channel}`;

export const isMotionChannel = (value: string): value is MotionChannel =>
  value === "rotation" || value === "translation";
