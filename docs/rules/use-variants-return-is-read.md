# `sous-chef/use-variants-return-is-read`

Variants are read from the styles `useVariants` returns, never from the sheet.

## Reports

- A bare `styles.useVariants({ … })` statement, whose return nothing reads.
- A read of the sheet after `const variantStyles = styles.useVariants({ … })`
  in the same function. A read above the call is the sheet's own, and stays.

```tsx
const variantStyles = styles.useVariants({ size });
return <View style={variantStyles.button} />;
```

## Why

The sheet ignores variants, the default ones included, so a style read from it
renders without them. Nothing throws, warns or type-errors, and the screen just
looks wrong. The Babel plugin used to hide this by shadowing `styles` after a
bare call; the return form does not depend on the plugin, and Unistyles'
Metro integration has no plugin to do it.
