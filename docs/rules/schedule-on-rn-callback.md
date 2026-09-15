# `sous-chef/schedule-on-rn-callback`

scheduleOnRN takes a callback defined in RN scope and at most one primitive argument.

## Reports

- Do not pass inline functions to scheduleOnRN — define the callback in RN runtime scope first. Inline functions inside worklets cause native crashes on Android.
- scheduleOnRN should have at most 2 arguments (function + one primitive). Functions cannot be serialized across the worklet boundary — capture them via RN-scope closure instead.

## Use instead

Define the callback in RN scope, capturing functions by closure: `const handleDismiss = () => onDismiss(id); scheduleOnRN(handleDismiss);`.

## Why

An inline function passed to `scheduleOnRN` crashes natively on Android, and a function passed as an extra argument crosses the worklet boundary as a plain object in release builds.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/schedule-on-rn-callback.js`](../../eslint/plugin/rules/schedule-on-rn-callback.js) · spec: [`__tests__/lint/rules/schedule-on-rn-callback.test.ts`](../../__tests__/lint/rules/schedule-on-rn-callback.test.ts)
