# `sous-chef/no-module-level-t`

A file that renders translates with the hook's t, not the module-level one.

## Reports

- Use `const { t } = useTranslation()` in a file that renders — the module-level `t` does not subscribe to language changes. If this file genuinely needs the module-level helper (a class component, or module-scope code), import it aliased: `import { t as tGlobal } from '#/i18n'`, so a bare `t(...)` in JSX is unambiguously the hook's.

## Use instead

`const { t } = useTranslation()`; where module scope genuinely needs the helper, `import { t as tGlobal } from '#/i18n'`.

## Why

The module-level `t` does not subscribe to language changes, so a bare `t(...)` in a component reads as the hook's and silently keeps the old language. A selector rather than an import ban, which cannot tell the deliberate `tGlobal` alias apart.

## Exempt

Enabled for production `src/**/*.tsx` only.

Source: [`eslint/plugin/rules/no-module-level-t.js`](../../eslint/plugin/rules/no-module-level-t.js) · spec: [`__tests__/lint/rules/no-module-level-t.test.ts`](../../__tests__/lint/rules/no-module-level-t.test.ts)
