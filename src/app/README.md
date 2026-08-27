# app

The composition root: the layer that knows which features this app has.

`src/components/` and `src/hooks/` are the **kit** — reusable, and forbidden
from importing a feature (`scripts/check-layer-purity.mjs`). But some modules
exist precisely to wire every feature together: the provider that mounts each
feature's subscriptions, the one that preloads each feature's data. Those are
not reusable and never will be; a sibling app writes its own.

They live here so the kit stays honest about what it is. A module belongs in
`src/app/` when removing a feature would require editing it.
