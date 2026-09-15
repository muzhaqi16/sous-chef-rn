# `sous-chef/no-rendered-enum`

A schema enum value reaches the screen through a translation table, never raw or string-munged.

## Reports

A value typed as a generated enum from `src/graphql/generated/schemaTypes.ts` (or a union of its members, nullish aside) that:

- `rendered` — reaches a JSX child, a copy attribute (the `i18next/no-literal-string` include list in `eslint/i18n.js`: `label`, `title`, `accessibilityLabel`, …), a copy-named object property (`{ label: status }`), a `t(…)` interpolation value, a `toastService.*` / `alertService.*` argument, or a template literal / `+` returned from a display formatter (`format*`, `*Label`, `*Text`, …) or assigned to a copy-named variable. The value is followed through `?.`, `!`, `??` / `||`, either branch of `?:`, the right side of `&&`, `String(…)` and array literals.
- `transformed` — is re-cased by `charAt` / `slice` / `substring` anywhere, or by `toLowerCase` / `toUpperCase` / `replace` / `split` / … when the result reaches one of the outputs above (a `const` it is assigned to is followed).
- `widened` — is passed to a display formatter (`format*`, `*Label`, …) whose parameter is declared `string`, which hides the munging from the checks above.

## Use instead

```ts
// A key composed from the enum: the template literal type is checked against en.json.
t(`mealType.${item.mealType}`);

// Or a table keyed by the enum, when the keys do not follow the values.
const STORAGE_TYPE_LABEL_KEYS: Record<StorageType, FormKey> = {
  [StorageType.Refrigerator]: 'typeRefrigerator',
  …
};
```

Put the copy in the owning feature's locales, in all four languages. A value the wire can carry but the client enum predates goes through `isTranslationKey` with a translated fallback (`labels.unknown`), never the raw value. `__tests__/i18n/enumKeyCoverage.test.ts` lists the namespaces composed from an enum.

## Why

An enum value is an API identifier (`SPECIAL_DIET`), not copy. Rendered raw it is English-shaped in every locale; re-cased (`"Special diet"`) it looks like copy while no locale can translate it, and a renamed value silently changes what users read.

## Exempt

- The key argument of `t(…)`: `t(`prefix.${value}`)` is how enum copy is looked up.
- A comparison or an API parameter (`value.toLowerCase() === 'frozen'`, a Spoonacular tag): not shown.
- Developer-facing text: logger, console, `errorService`, `Telemetry`, `new …Error(…)`, `throw`.
- Non-copy props (`value`, `status`, `testID`, `key`) and template literals that are ids or keys.
- Test files, `.graphql` documents and files without type information.

Source: [`eslint/plugin/rules/no-rendered-enum.js`](../../eslint/plugin/rules/no-rendered-enum.js) · spec: [`__tests__/lint/rules/no-rendered-enum.test.ts`](../../__tests__/lint/rules/no-rendered-enum.test.ts)
