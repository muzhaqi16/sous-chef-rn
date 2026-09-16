# `sous-chef/no-string-keyed-lookup`

A closed lookup table is keyed by the real key type, never by string.

## Reports

- `closedTable` — a `const` whose type has a `string` key (`Record<string, V>`, `Partial<Record<string, V>>`, `Readonly<…>`, `{ [k: string]: V }`, an intersection carrying one, `Map<string, V>` / `ReadonlyMap<string, V>`) while its initializer lists every key it will hold: an object literal whose keys are identifiers, string or number literals, or computed from a literal-typed value (`[Status.On]`), with no spread; or `new Map([[k, v], …])` with such keys. It is reported when it is used as a lookup: read by a non-literal key (`T[key]`, `T.get(key)`, `key in T`, `Object.hasOwn(T, key)`) or exported. `{ … } satisfies Record<string, V>` is reported the same way once a finite key reads it. The message names the key type those reads carry, when they carry one.
- `finiteKeyRead` — a read of such a table, in any file, whose key is typed as a string-literal union or an enum (`ICON[tone]` with `tone: Tone`). That type is the table's real key; the message names it (the enum, for a union of an enum's members).

## Use instead

```ts
const STATUS_TONE: Record<GoalStatus, TextTone> = {
  [GoalStatus.OnTarget]: 'success',
  [GoalStatus.UnderTarget]: 'warning',
  [GoalStatus.OverTarget]: 'error',
};
```

Key the table by the codegen enum or the union its keys belong to: `Record<Key, V>` when every key has a value, `Partial<Record<Key, V>>` when some do not. Where the key arrives as a plain `string` (a server field, a device region), declare the key union beside the table and narrow the string to it once, with a type guard, at the boundary. Never `satisfies Record<string, V>`, never a cast.

## Why

A `string` key accepts a key the table never had. A misspelled or removed key compiles, a member added to the enum gets no entry and no error, and under `noUncheckedIndexedAccess` every read is `V | undefined`, so the gap becomes a silent fallback at runtime. Keyed by its real type, a missing entry is a compile error at the table and a wrong key is one at the read.

## Exempt

- A value type of `unknown`, `any` or `never`: object guards, JSON blobs and empty sentinels.
- A table populated or changed at runtime: an empty initializer, a spread, a computed key from a runtime value, or a write in its file (`T[k] = …`, `T.k = …`, `delete`, `++`, `.set` / `.delete` / `.clear`, `Object.assign(T, …)`).
- A bag that is only handed over whole (headers passed to `fetch`, labels to a counter) and not exported.
- A type annotation naming a type declared in another module that is not the standard library: a library's `TypePolicies` or the kit's `FieldRendererRegistry` is a contract the table fills, not a key type it chose.
- A `satisfies` preset read only by property (`FLASHLIST_DEFAULTS.fullScreen`): its literal keys are kept, so those reads are checked.
- An index signature in an interface or type describing external data, and a properly keyed table widened to a `string`-keyed local for one read with a runtime string.
- Test files, `__mocks__`, `e2e`, generated files, `locales/` and `i18n/` resources, and files without type information.

Related: `sous-chef/no-unchecked-domain-literal` reports a `string`-keyed table whose keys are all values of one generated schema enum.

Source: [`eslint/plugin/rules/no-string-keyed-lookup.js`](../../eslint/plugin/rules/no-string-keyed-lookup.js) · spec: [`__tests__/lint/rules/no-string-keyed-lookup.test.ts`](../../__tests__/lint/rules/no-string-keyed-lookup.test.ts)
