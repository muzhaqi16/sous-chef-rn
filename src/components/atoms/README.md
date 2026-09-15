# atoms

The smallest reusable pieces of UI. An atom renders itself and, at most,
composes `Text` or another atom — it does not orchestrate other components,
own data, or know about a feature.

`Text`, `Badge`, `Card`, `Divider`, `ProgressBar`, `Label`, `SectionHeader`,
`IconButton` and the `Skeleton/` family all live here. `Button`, `EmptyState`,
`ErrorState`, `Loading` and `BaseInput` do NOT — each renders several atoms, so
each is a molecule.

## One folder per tier

There is no `base/`: a folder beside the tiers would hold components by taste,
not by what they render. `DataStateView` composes `Loading`, `ErrorState` and
`EmptyState` and routes between them, which makes it a molecule.

## Where a component goes

The tier is what a component RENDERS, and it is computed rather than agreed:

- **atoms** — renders at most ONE other kit component.
- **molecules** — renders SEVERAL atoms, or wraps one molecule as a preset
  (`EmailInput` over `BaseInput`).
- **organisms** — renders two or more molecules, renders an organism, or owns a
  bottom sheet.
- **templates** — page-level scaffolding.

A file inside a component FAMILY folder (`SwipeableItem/SwipeActions.tsx`) is
internal to that family and takes the family's tier; only the entry is placed.

A component that belongs to exactly one feature does not go in any of these; it
goes in that feature's own `components/` folder.
