# `sous-chef/no-unsafe-cast`

No `as any`, `any[]`, `unknown`, `never`, `Record<…>`, `keyof`, translation-key or schema-enum casts.

## Reports

- `as any` and `as any[]` — they switch type checking off for the value.
- `as unknown`, typically the `x as unknown as T` double cast that asserts anything.
- `as never` — `never` is assignable to every type, so it silences a mismatch exactly like `as any` while reading as deliberate.
- `as Record<…>` — it asserts an object shape instead of proving it.
- `as keyof …`, and a key list asserted as `(keyof …)[]`, `readonly (keyof …)[]`, `Array<keyof …>` or `Extract<keyof …, …>` — it indexes with a key the object may not have, so the read is `undefined` under a type that says it cannot (an inherited name like `toString` even resolves to a function). Narrow the key with `isOwnKey(obj, key)` from `#utils/isOwnKey`, iterate `Object.values`/`Object.entries` or a typed list of the keys, or type the key where it is declared. A value cast such as `as T[keyof T]` is not reported.
- `as TranslationKey` / `as ParseKeys` — it compiles a key the copy may not declare, which renders as a raw dot-path. Type the storing field `TranslationKey`, or check runtime-built keys with `isTranslationKey`.
- A cast to a generated schema enum (an `export enum` in `src/graphql/generated/schemaTypes.ts`): `as ProfileVisibility`, `as RecurringPattern | null`, `as UnitType | undefined`, `as Cuisine[]`, `as Array<Diet>`, `as ReadonlyArray<…>`, `as readonly (Diet | null)[]`, `as Types.UnitType` — any type built only from enums plus `null`/`undefined`. The cast lets through a string the schema has no member for, and the server refuses it on every write. Type the source as the enum where it is declared, make a generic picker carry the enum type, or narrow with a guard `(v: string): v is E => new Set<string>(Object.values(E)).has(v)`; build an enum list with `flatMap(r => (r.x ? [r.x] : []))`, not `.filter(Boolean) as E[]`. The match is by name, so a local type that shadows a generated enum's name is reported too — rename the local type.

## Use instead

In this order:

1. **Type inference.** Delete the hand-written or `unknown` type that blocks it, so the generated type flows through — e.g. drop a local `pantriesConnection?: unknown` and `extractNodes(home.pantriesConnection)` infers its node.
2. **Narrowing** with a real type guard: `typeof`, `in`, `instanceof`, or a predicate function.
3. **A declared type where the value is declared** — never at the call site — when inference is impossible (a public return contract, a plain `DocumentNode` that must become typed).

## Why

Each of these makes the compiler accept whatever it is given, so the next schema or signature change compiles and fails at runtime instead.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-unsafe-cast.js`](../../eslint/plugin/rules/no-unsafe-cast.js) · spec: [`__tests__/lint/rules/no-unsafe-cast.test.ts`](../../__tests__/lint/rules/no-unsafe-cast.test.ts)
