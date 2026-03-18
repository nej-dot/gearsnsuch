import { vec } from "../domain/geometry";
import type { MechanismDocument } from "../domain/mechanism";

export const createDemoMechanism = (): MechanismDocument => ({
  schemaVersion: 1,
  metadata: {
    name: "Starter Mechanism Playground",
    description:
      "A fake-first demo with a driven gear train, rack-and-pinion, and a crank-slider linkage.",
  },
  view: {
    width: 1200,
    height: 780,
    grid: 40,
  },
  parts: [
    {
      id: "gear-driver",
      type: "gear",
      label: "Driver Gear",
      frame: {
        position: vec(220, 220),
        rotation: 0,
      },
      params: {
        teeth: 24,
        module: 4.43,
        pressureAngleDeg: 20,
        boreRadius: 10,
      },
      style: {
        stroke: "#28495e",
      },
    },
    {
      id: "gear-idler",
      type: "gear",
      label: "Follower Gear",
      frame: {
        position: vec(344, 220),
        rotation: 0,
      },
      params: {
        teeth: 32,
        module: 4.43,
        pressureAngleDeg: 20,
        boreRadius: 12,
      },
      style: {
        stroke: "#28495e",
      },
    },
    {
      id: "rack-output",
      type: "rack",
      label: "Rack",
      frame: {
        position: vec(344, 346),
        rotation: 0,
      },
      params: {
        length: 280,
        height: 30,
        axis: vec(1, 0),
        toothPitch: Math.PI * 4.43,
      },
      style: {
        stroke: "#28495e",
      },
    },
    {
      id: "crank-main",
      type: "crank",
      label: "Crank",
      frame: {
        position: vec(730, 230),
        rotation: 0,
      },
      params: {
        radius: 72,
      },
      style: {
        stroke: "#28495e",
      },
    },
    {
      id: "rod-main",
      type: "rod",
      label: "Connecting Rod",
      frame: {
        position: vec(860, 230),
        rotation: 0,
      },
      params: {
        length: 190,
        thickness: 18,
      },
      style: {
        stroke: "#28495e",
      },
    },
    {
      id: "slider-main",
      type: "slider",
      label: "Slider",
      frame: {
        position: vec(880, 230),
        rotation: 0,
      },
      params: {
        axis: vec(1, 0),
        travelMin: -120,
        travelMax: 180,
        width: 74,
        height: 44,
      },
      style: {
        stroke: "#28495e",
      },
    },
    {
      id: "pivot-guide",
      type: "pivot",
      label: "Ground Pivot",
      frame: {
        position: vec(730, 230),
        rotation: 0,
      },
      params: {
        displayRadius: 14,
      },
      style: {
        stroke: "#28495e",
      },
    },
  ],
  connections: [
    {
      id: "mesh-1",
      type: "gearMesh",
      gearAId: "gear-driver",
      gearBId: "gear-idler",
    },
    {
      id: "rack-1",
      type: "rackPinion",
      pinionId: "gear-idler",
      rackId: "rack-output",
      direction: 1,
    },
    {
      id: "crank-slider-1",
      type: "crankSlider",
      crankId: "crank-main",
      rodId: "rod-main",
      sliderId: "slider-main",
      branch: "positive",
    },
  ],
  drivers: [
    {
      id: "driver-gear",
      label: "Motor A",
      targetPartId: "gear-driver",
      channel: "rotation",
      mode: "velocity",
      value: 1.4,
      enabled: true,
    },
    {
      id: "driver-crank",
      label: "Motor B",
      targetPartId: "crank-main",
      channel: "rotation",
      mode: "velocity",
      value: 1.2,
      enabled: true,
    },
  ],
});
