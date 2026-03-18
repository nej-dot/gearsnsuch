# Implementation Plan

## Milestone 1: core fake-first engine
- finalize document schema
- add graph solver tests
- support motor drivers, gears, racks, coaxial shafts
- define diagnostics for contradictory graphs

## Milestone 2: editor basics
- tool modes: select, move, create part, connect
- snapping to ports and axes
- connection creation workflow
- inspector for parameters and driver assignment

## Milestone 3: linkage library
- crank-slider
- four-bar
- rocker and offset slider variants
- solver branch selection and ambiguity handling

## Milestone 4: authoring quality
- undo/redo
- copy/paste
- groups
- save/load files
- starter examples

## Milestone 5: hybrid experiments
- physics adapter interface
- body/joint mapping for eligible parts
- authority handoff rules
- keep transmissions custom-authoritative

## Suggested test strategy
- pure unit tests for gear ratio propagation
- unit tests for rack-pinion conversion
- unit tests for crank-slider geometry
- snapshot tests for document serialization
- interaction tests for placement and snapping
