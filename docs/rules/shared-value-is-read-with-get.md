# `sous-chef/shared-value-is-read-with-get`

A shared value is read with `.get()`, never `.value`.

## Reports

A `.value` read on anything typed as a Reanimated shared or derived value: a
type with `value`, `get`, `set`, `modify` and `addListener`. A `.value` write is
`no-restricted-syntax`'s `sharedValueAssignment`, so this rule leaves it alone.

```ts
const offset = useSharedValue(0);
const style = useAnimatedStyle(() => ({
  transform: [{ translateX: offset.get() }],
}));
```

## Why

The app compiles with the React Compiler, which treats `.value` as an ordinary
property it may cache, and Reanimated gives `.get()` and `.set()` for exactly
that. Writes already go through `.set()`; reads through `.get()` keep one way to
touch a shared value, so a read on the JS thread is as easy to spot as a write.

Source: [`eslint/plugin/rules/shared-value-is-read-with-get.js`](../../eslint/plugin/rules/shared-value-is-read-with-get.js) · spec: [`__tests__/lint/typedRules/shared-value-is-read-with-get.ts`](../../__tests__/lint/typedRules/shared-value-is-read-with-get.ts)
