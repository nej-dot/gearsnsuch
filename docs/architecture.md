# Architecture Notes

## Guiding principle

Treat the app as a **kinematic authoring tool** with a **logical transmission graph** plus **specialized geometry solvers**. Do not start from rigid-body simulation and then try to force gears into it.

## Layer responsibilities

### `src/domain`
- stable, semantic model
- user-facing parts and connections
- future migration-safe save format

### `src/engine`
- graph propagation
- linkage math
- validity checks
- eventually physics adapter boundary

### `src/renderer`
- stateless drawing from `SimulationFrame`
- zero editing or solving authority

### `src/editor`
- selection
- dragging
- snapping
- tool modes
- command stack later

### `src/serialization`
- versioning
- parsing
- migrations

## Recommended evolution

### Phase 1: fake-first
- one motion graph
- dedicated solver modules per linkage family
- no collisions
- deterministic play/pause

### Phase 2: richer kinematics
- compound gears
- belt and chain relations
- more generalized pivot/rod network solving
- assembly diagnostics

### Phase 3: hybrid physics
- add `PhysicsWorldAdapter`
- instantiate bodies only for eligible parts
- sync custom-authoritative transmission state into the physics world
- read back dynamic body poses for allowed parts only

## Hybrid authority model

In the future, each part can declare one of three authority modes:

- `kinematic`: pose comes from custom solver
- `dynamic`: pose comes from physics engine
- `hybrid`: one or more channels are custom-authored while the rest are physics-resolved

Examples:
- gear on a shaft: `kinematic`
- loose plate with collisions: `dynamic`
- slider constrained by a logical screw drive but colliding elsewhere: `hybrid`

## Important non-goals for v1

- generic constraint satisfaction for every mechanism
- tooth collision
- realistic energy transfer
- friction, backlash, or contact patch simulation

Those can come later, but they should not define the first architecture.

