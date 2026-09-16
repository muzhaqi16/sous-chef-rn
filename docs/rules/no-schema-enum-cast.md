# `sous-chef/no-schema-enum-cast`

No casts to a generated schema enum.

## Reports

A cast to a generated schema enum (an `export enum` in `src/graphql/generated/schemaTypes.ts`): `as ProfileVisibility`, `as RecurringPattern | null`, `as UnitType | undefined`, `as Cuisine[]`, `as Array<Diet>`, `as ReadonlyArray<…>`, `as readonly (Diet | null)[]`, `as Types.UnitType` — any type built only from enums plus `null`/`undefined`.

The match is by name, so a local type that shadows a generated enum's name is reported too — rename the local type.

## Use instead

In this order:

1. **Type inference.** Delete the hand-written or `unknown` type that blocks it, so the generated type flows through.
2. **Narrowing** with a real guard: `(v: string): v is E => new Set<string>(Object.values(E)).has(v)`.
3. **A declared type where the value is declared** — never at the call site.

Build an enum list with `flatMap(r => (r.x ? [r.x] : []))`, not `.filter(Boolean) as E[]`.

## Why

The cast lets through a string the schema has no member for, and the server refuses it on every write.

## Related

The general cast bans — `as any`, `as unknown`, `as never`, `as Record<…>`, `as keyof …`, `as TranslationKey` — are [`no-restricted-syntax` entries](restricted-syntax.md), and `as any` is also `@typescript-eslint/no-explicit-any`. This rule is separate because an enum cast cannot be recognised by a selector: it needs the generated enum names.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-schema-enum-cast.js`](../../eslint/plugin/rules/no-schema-enum-cast.js) · spec: [`__tests__/lint/rules/no-schema-enum-cast.test.ts`](../../__tests__/lint/rules/no-schema-enum-cast.test.ts)
