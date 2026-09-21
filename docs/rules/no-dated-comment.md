# `sous-chef/no-dated-comment`

A comment describes the code as it is, so it carries no date.

## Reports

- A comment containing an ISO date (`YYYY-MM-DD`) outside a backtick code span.

## Use instead

State what the code does now, in the present tense. What changed and when goes in the commit message and the PR; a measurement that justifies a value goes in `docs/`.

## Why

A dated comment is a change log entry: "Re-recorded 2026-09-13…", "Since 2026-08-22 the server…". It reads as current and goes stale on the next change. `no-warning-comments` catches narrating vocabulary ("previously", "used to"), but a log entry needs none of those words; its date is what gives it away.

## Exempt

A date inside a `code span`, which is an example value rather than a timestamp. Applies to the same files as `no-warning-comments`: `src/**`, `__tests__/**` and `e2e/**`.

Source: [`eslint/plugin/rules/no-dated-comment.js`](../../eslint/plugin/rules/no-dated-comment.js) · spec: [`__tests__/lint/rules/no-dated-comment.test.ts`](../../__tests__/lint/rules/no-dated-comment.test.ts)
