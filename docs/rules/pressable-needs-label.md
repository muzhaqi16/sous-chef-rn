# `sous-chef/pressable-needs-label`

A pressable with no text child carries an accessibilityLabel.

## Reports

- A control with no text child needs an `accessibilityLabel` — a screen reader announces it as "button" and nothing else. Give it a label, put a `<Text>` in it, or mark it `accessible={false}` if it is decorative.

## Use instead

An `accessibilityLabel`, a `<Text>` child, or `accessible={false}` when the control is decorative.

## Why

React Native names a pressable from its text children; an icon-only control reaches VoiceOver and TalkBack as "button" and nothing else.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/pressable-needs-label.js`](../../eslint/plugin/rules/pressable-needs-label.js) · spec: [`__tests__/lint/rules/pressable-needs-label.test.ts`](../../__tests__/lint/rules/pressable-needs-label.test.ts)
