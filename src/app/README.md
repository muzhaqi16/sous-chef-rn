# app

The mobile composition root: what assembles this host — the platform install,
the Apollo client over the native socket, and the session and start-up steps a
device adds.

What every host runs to start the core lives in `src/bootstrap/`, a core
folder, including the modules that wire every feature together: the provider
that mounts each feature's subscriptions and the one that preloads each
feature's data.

`src/components/` and `src/hooks/` are the **kit** — reusable, and forbidden
from importing a feature (a `boundaries/dependencies` policy in
`eslint/boundaries.js`). A module that knows which features exist belongs in
`src/bootstrap/` when every host runs it, and here when only this one does.
