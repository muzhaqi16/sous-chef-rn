# `sous-chef/text-needs-role`

A `<Text>` outside the kit names its typography role; error copy everywhere is `role="error"` with `tone="error"`.

## Reports

- `missingRole` — Name a typography role: `<Text role="body">`. A role-less `<Text>` falls to the atom default, so two elements meant to match can set at different sizes. Drop fontSize/fontWeight/lineHeight/letterSpacing from its style in favour of the role, and give colour through `tone`.
- `errorToneNeedsErrorRole` — Error copy sets at the `error` role: `<Text role="error" tone="error">`. A destructive label or a negative status that is not error copy takes `tone="danger"` and keeps its own role.
- `errorRoleNeedsErrorTone` — `role="error"` pairs with `tone="error"`: the role carries only size and weight, so without the tone the error line renders in the default text colour.
- `errorColourInStyle` — Give the error colour through `tone`, not a style: `<Text role="error" tone="error">` for error copy, `tone="danger"` for a destructive label or a negative status.

Matched: a JSX element whose name is the local binding of the `Text` atom (`#components/atoms/Text`, `#/components/atoms/Text`, or a relative path to it).

- `missingRole`: no `role` attribute and no spread attribute.
- The pairing: the string literals `tone` and `role` can take (a literal, or the literal branches of a `?:`, `||` or `??`) — a `tone` that can be `'error'` needs a `role` that can be `'error'`, and the reverse. A spread attribute, or a non-literal on the side that must answer, skips the check.
- `errorColourInStyle`: its `style` names an inline object, or a key of a `StyleSheet.create` in the same file, whose own `color` is `….colors.error` or `….colors.danger`. A shared style module and a nested `variants` colour are not read.

## Use instead

One of the eleven roles in `src/theme/foundations/type.ts`, colour through `tone`. A nested `<Text>` names the role of the run it sits in: the atom does not inherit its parent's role, so a role-less span inside a `caption` sets at `body` size. An element that cannot take the prop spreads `...theme.type.<role>` into its style.

Error copy — a field's validation message, a failure line under a form, a "not found" fallback — is `<Text role="error" tone="error">`, whatever the surrounding text sets at. A line that is sometimes an error picks both from the same condition. A red element that is not error copy — a destructive action's label, a required asterisk, an expired status, a full-screen error state's heading — takes `tone="danger"` with its own role.

## Why

A role-less `<Text>` renders `body`, whatever the text beside it uses. On one screen a role-less bullet and a `caption` bullet set at different sizes, and nothing but review could see it. Error lines drifted the same way: one form's message set at `caption`, the next at `body`, a third at a style's own `fontSize`.

## Exempt

`missingRole` is off in `src/components/**` (the kit, where `size` / `weight` / `lineHeight` are the escape hatches and a wrapper passes its caller's role through) via `{ requireRole: false }`; the pairing and style checks apply there too. Test files (`**/__tests__/**`, `*.test.ts(x)`), `__mocks__` and `__perf__` are exempt.

Source: [`eslint/plugin/rules/text-needs-role.js`](../../eslint/plugin/rules/text-needs-role.js) · spec: [`__tests__/lint/rules/text-needs-role.test.ts`](../../__tests__/lint/rules/text-needs-role.test.ts)
