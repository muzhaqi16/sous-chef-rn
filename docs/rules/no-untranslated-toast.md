# `sous-chef/no-untranslated-toast`

Copy reaching a toast or alert is translated: no literals, templates or server messages.

## Reports

- Untranslated string passed to a user-facing toast/alert. Add a key to src/i18n/locales/en.json and pass t(...) — the module-level `t` from #/i18n works outside components.
- Never display a server `message`. Settle the write with `settleMutation` (`present: 'none'` when you show it yourself) and show `failure.body` — it resolves the refused field, then the error code, then your localized fallback.
- Template literal passed to a user-facing toast/alert. Interpolate through i18next instead — t(key, { name }) — so the sentence stays reorderable, and use \_one/\_other keys for counts rather than appending an "s".

## Use instead

`t(key, { name })` for copy; for a failed write, `settleMutation` (`present: 'none'` when showing it yourself) and its `failure.body`.

## Why

i18next/no-literal-string covers JSX; a toast or alert is an ordinary call in a hook or service, so the SINKS are named instead, which keeps the check finite. A server `message` is English by construction — the client sends no `Accept-Language`. The `{3}` letter guard skips symbol arguments.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-untranslated-toast.js`](../../eslint/plugin/rules/no-untranslated-toast.js) · spec: [`__tests__/lint/rules/no-untranslated-toast.test.ts`](../../__tests__/lint/rules/no-untranslated-toast.test.ts)
