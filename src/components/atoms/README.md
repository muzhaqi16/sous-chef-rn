# atoms

The smallest reusable pieces of UI. An atom renders itself and, at most,
composes `Text` or another atom — it does not orchestrate other components,
own data, or know about a feature.

`Text`, `Badge`, `Card`, `Divider`, `ProgressBar`, `Label`, `SectionHeader`,
`IconButton` and the `Skeleton/` family all live here. `Button`, `EmptyState`,
`ErrorState`, `Loading` and `BaseInput` do NOT — each renders several atoms, so
each is a molecule.

## Why there is no `base/`

There used to be one, holding 25 components beside these. No rule separated the
two: `Button` was in `base/` while `IconButton` and `PressableScale` were here;
`Badge` was in `base/` while `Chip` and `QuantityBadge` were here. This file
even gave _"Examples: Button, Input, Label"_ while `Button.tsx` sat in the other
folder, and `docs/architecture.md` documented the taxonomy as **atoms,
molecules, organisms, templates** without mentioning `base/` at all.

So `base/` folded into `atoms/`. The documented taxonomy is the one that
survives.

`DataStateView` did not come with it — it composes `Loading`, `ErrorState` and
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

`node scripts/check-component-tier.mjs` holds this, and its baseline is EMPTY —
which makes it an invariant, not a backlog. The taxonomy was documentation
before, and documentation drifted: this file's own examples used to contradict
its own rule.

A component that belongs to exactly one feature does not go in any of these; it
goes in that feature's own `components/` folder.
