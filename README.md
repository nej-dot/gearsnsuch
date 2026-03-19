# Gears n Such

A fake-first 2D mechanism playground scaffold focused on finishability, predictable motion, and a clean upgrade path toward hybrid physics later.

## Recommended stack

### Option A: React + TypeScript + SVG + custom kinematic engine
- Best for: the first working prototype.
- Why: easiest hit-testing, editing, labels, overlays, and debug visibility.
- Tradeoff: SVG will hit scaling limits before Canvas/WebGL if you push to very large scenes.

### Option B: React + TypeScript + Canvas 2D + custom kinematic engine
- Best for: larger scenes sooner.
- Why: better raw draw throughput and lower DOM overhead.
- Tradeoff: custom picking, text layout, and editor tooling take longer to build.

### Option C: React + TypeScript + PixiJS + custom kinematic engine
- Best for: ambitious rendering and long-term polish.
- Why: excellent scene graph and performance.
- Tradeoff: more abstraction up front, more editor plumbing, slower first prototype.

## Opinionated recommendation

Start with **React + TypeScript + Vite + SVG** and keep the simulation engine completely renderer-agnostic.

That gives you:
- the fastest route to a usable editor
- easy overlays for constraints, diagnostics, and snap hints
- a clean path to swap the renderer to Canvas or Pixi later without rewriting the solver

## Architecture

Use six explicit layers from day one:

1. `domain`
- part definitions
- parameter schemas
- connection types
- document model

2. `engine`
- motion graph propagation for gears, racks, coaxial shafts, belts later
- kinematic solvers for crank-slider, four-bar, and other closed linkages
- contradiction detection and diagnostics

3. `renderer`
- pure scene drawing from solved poses
- no simulation logic

4. `editor`
- selection
- dragging
- snapping
- tool modes
- command history later

5. `serialization`
- versioned JSON save/load
- schema migration later

6. `integration`
- future adapter seam for rigid-body physics
- collision queries and joint syncing later

## Motion model

### 1. Motion graph for transmissions

Represent scalar motion as graph nodes:
- `partId:rotation`
- `partId:translation`

Then propagate values through logical edges:
- gear mesh: `thetaB = -thetaA * teethA / teethB`
- coaxial: `thetaB = thetaA * ratio`
- rack-pinion: `xRack = thetaPinion * pitchRadius`
- future belt/chain: same pattern, but no tooth collision required

This is the authoritative model for transmissions because it stays deterministic and clean.

### 2. Pose solve for geometry

After scalar motion is known, resolve actual part poses:
- gears: fixed center, solved angle
- racks: fixed axis, solved translation
- sliders: track axis + solved translation
- cranks: fixed pivot + solved angle
- rods: derived from connected endpoints

### 3. Linkage solvers for closed loops

Use dedicated math solvers for each family instead of one giant generic solver first:
- crank-slider
- four-bar
- rocker
- offset slider-crank

That keeps v1 understandable and debuggable.

### 4. Contradictions

If the same motion channel gets two incompatible values, surface it as a diagnostic:
- conflicting drivers
- impossible linkage dimensions
- over-constrained graph
- slider exceeding travel

For v1, warn and freeze the last valid solve rather than trying to explode into unstable simulation behavior.

## Future hybrid physics path

Keep these abstractions now so hybrid later stays realistic:

### What should exist now
- `MechanismDocument`: stable authoring format
- `MechanismPart`: semantic parts, not engine bodies
- `MechanismConnection`: semantic relationships, not physics joints
- `SimulationFrame`: solved poses independent of renderer
- `SimulationDiagnostic`: contradictions and warnings
- `Motion graph`: authoritative transmission network

### What should remain authoritative later
- gear ratios
- rack-pinion relationships
- shared shaft / compound transmission logic
- belt and chain phase relationships

These should stay custom even in a hybrid version, because physics engines are not the right source of truth for exact transmission behavior.

### What can become physics-driven later
- free rigid links
- collisions between loose bodies
- dynamic settling
- joint limit responses
- contact and stacking

### How not to paint yourself into a corner
- never let render objects be the data model
- never let a physics body become the canonical part definition
- keep ports, anchors, and constraints semantic
- make the solver output poses, not direct draw calls
- keep the editor writing JSON-ish document data, not engine state

## Suggested v1 scope

Ship this before thinking about general rigid-body simulation:

- motor inputs
- spur gears
- rack and pinion
- fixed pivots
- cranks
- rods / link bars
- sliders on tracks
- crank-slider
- simple open-chain linkages
- save/load JSON
- drag/select/edit parameters
- graph diagnostics

Wait on these until after the prototype feels good:

- arbitrary closed loops everywhere
- broad collision handling
- belts/chains
- compound gears on shared shafts
- undo/redo
- multiplayer / collaboration

## Current scaffold

This repo includes:
- a React + TypeScript + Vite app shell
- a versioned mechanism document model
- a motion-graph solver for gears, rack-pinion, and coaxial rotation
- a dedicated crank-slider kinematic solve
- an SVG viewport with a demo mechanism
- simple part inspection and JSON import/export

## Getting started

This workspace is scaffolded for Bun:

```bash
source ~/.nvm/nvm.sh
nvm use
bun install
bun run dev
```

If `bun` is not installed yet, install it first and then run the commands above.

## GitHub Pages deployment

This repo is configured to deploy to GitHub Pages from GitHub Actions.

- Push to `main` to trigger the deployment workflow.
- The workflow builds with Bun and publishes the `dist/` output.
- It sets `VITE_BASE_PATH` automatically to `/<repo-name>/`, which is the correct path for a project site such as `https://nej-dot.github.io/gearsnsuch/`.

To test the Pages build locally:

```bash
source ~/.nvm/nvm.sh
nvm use
VITE_BASE_PATH=/gearsnsuch/ bun run build
```

## Suggested next milestones

1. Add a real editor tool system.
2. Add snapping and connection creation.
3. Add four-bar and generic hinge-chain solving.
4. Add undo/redo command history.
5. Add compound gears and shared shafts.
6. Add a physics adapter layer for hybrid experiments.
