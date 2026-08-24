# atoms

The smallest reusable pieces of UI. An atom renders itself and, at most,
composes `Text` or another atom — it does not orchestrate other components,
own data, or know about a feature.

`Button`, `Text`, `Badge`, `Chip`, `Label`, `Card`, `EmptyState`, `ErrorState`,
`Loading` and the `Skeleton/` family all live here.

## Why there is no `base/`

There used to be one, holding 25 components beside these. No rule separated the
two: `Button` was in `base/` while `IconButton` and `PressableScale` were here;
`Badge` was in `base/` while `Chip` and `QuantityBadge` were here. This file
even gave *"Examples: Button, Input, Label"* while `Button.tsx` sat in the other
folder, and `docs/architecture.md` documented the taxonomy as **atoms,
molecules, organisms, templates** without mentioning `base/` at all.

So `base/` folded into `atoms/`. The documented taxonomy is the one that
survives.

`DataStateView` did not come with it — it composes `Loading`, `ErrorState` and
`EmptyState` and routes between them, which makes it a molecule.

## Where a component goes

- **atoms** — renders itself; composes nothing, or only `Text`/another atom.
- **molecules** — composes several atoms into one reusable unit.
- **organisms** — composes molecules, and may read data.
- **templates** — page-level scaffolding.

A component that belongs to exactly one feature does not go in any of these; it
goes in that feature's own `components/` folder.
