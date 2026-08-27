# catalog

The grocery catalog: the `Item` entity every other feature refers to, its
lookup fields (item, brand, unit, category, store), and storage locations.

Two features consume it — `pantry` places items into storage locations, `home`
reaches its management screen from household settings — which is exactly why it
is its own feature rather than living inside either. Removing `pantry` or `home`
leaves the catalog intact; folding it into one of them would not.

## `ui/` is public, `components/` is not

Most features keep all their UI private: a component two features want is a kit
component. The catalog is the exception the rule needs — its whole purpose is to
be consumed, and its pickers are domain UI that does not belong in a domain-free
kit.

So this feature has two component directories:

- **`ui/`** — the public surface, alongside `screens/`, `hooks/` and
  `manifest.ts`. Other features may import these.
- **`components/`** — private internals, same as every other feature.

Anything in `ui/` is an API. Changing its props is a change to other features.
