# `sous-chef/no-t-default-value`

A translation call carries no inline fallback copy: the key resolves in every locale.

## Reports

A call to `t`, `tGlobal`, `translate` or any `*.t` (`i18n.t`, `getI18n().t`) that passes:

- `stringFallback` — a string as its second argument: a literal, a template literal, or (with type information) any string-typed value such as a server `message`;
- `defaultValue` — a `defaultValue` option in its options object.

## Use instead

Declare the key in the owning feature's `en.json` (and `es` / `it` / `sq`) and call `t(key)` / `t(key, { count })`. A key composed from data the types cannot see is checked with `isTranslationKey(key)` and falls back to another translated key. A caller's copy for an unmapped error code goes to `localizedErrorMessage(error, fallback)`, not into `t`.

## Why

A fallback renders only when the key is missing, so it is English in every locale exactly when something is wrong, and it hides that the key is missing from `check-i18n` and review. With typed keys (`TranslationKey`) a missing key is a compile error, so the fallback is dead or wrong. `TranslateFn` and the module-level `t` in `#/i18n` take no fallback.

## Exempt

Test files and `.graphql` documents.

Source: [`eslint/plugin/rules/no-t-default-value.js`](../../eslint/plugin/rules/no-t-default-value.js) · spec: [`__tests__/lint/rules/no-t-default-value.test.ts`](../../__tests__/lint/rules/no-t-default-value.test.ts)
