# `sous-chef/no-parse-float`

Parse typed numbers with parseDecimalInput, never parseFloat.

## Reports

- Use parseDecimalInput from #/utils/parseDecimalInput instead of parseFloat. parseFloat reads "4,99" as 4 on any device whose keyboard offers a comma, silently saving a wrong number. If this value is machine-generated and never typed, both behave identically — so use parseDecimalInput regardless.

## Use instead

`parseDecimalInput` from `#/utils/parseDecimalInput`.

## Why

`parseFloat` stops at the first character it cannot read, so on a keyboard offering `,` it turns `4,99` into `4` and saves that — no error, no validation message. `Number.parseFloat` is the same function and is matched too.

## Exempt

`src/utils/parseDecimalInput.ts` (the replacement itself). Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-parse-float.js`](../../eslint/plugin/rules/no-parse-float.js) · spec: [`__tests__/lint/rules/no-parse-float.test.ts`](../../__tests__/lint/rules/no-parse-float.test.ts)
