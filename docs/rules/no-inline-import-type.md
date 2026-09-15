# `sous-chef/no-inline-import-type`

Import types at the top of the file, not through inline import() types.

## Reports

- Avoid inline import() types. Import the type at the top of the file instead.

## Use instead

`import type { Thing } from "./other"` at the top of the file.

## Why

An inline `import("…")` type hides a dependency from the import list, where review, the boundary zones and madge read it.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-inline-import-type.js`](../../eslint/plugin/rules/no-inline-import-type.js) · spec: [`__tests__/lint/rules/no-inline-import-type.test.ts`](../../__tests__/lint/rules/no-inline-import-type.test.ts)
