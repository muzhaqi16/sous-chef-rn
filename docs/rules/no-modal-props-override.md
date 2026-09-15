# `sous-chef/no-modal-props-override`

Do not override onChange or animatedIndex after spreading useStandardBottomSheet's modalProps.

## Reports

- Do not override `onChange` or `animatedIndex` after `{...modalProps}` — useStandardBottomSheet supplies both: a composed onChange (drives the global backdrop claim) and the animatedIndex SharedValue (drives backdrop opacity in lockstep with the sheet). Overriding either silently breaks the dim layer. Forward via the hook's options API: `useStandardBottomSheet({ ..., onChange: handler })`. (Other props like `snapPoints`, `keyboardBlurBehavior`, `onDismiss` can be overridden safely.)

## Use instead

The hook's options: `useStandardBottomSheet({ …, onChange: handler })`.

## Why

The hook supplies both: a composed `onChange` that drives the global backdrop claim, and the `animatedIndex` SharedValue the backdrop opacity follows. Overriding either silently breaks the dim layer.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-modal-props-override.js`](../../eslint/plugin/rules/no-modal-props-override.js) · spec: [`__tests__/lint/rules/no-modal-props-override.test.ts`](../../__tests__/lint/rules/no-modal-props-override.test.ts)
