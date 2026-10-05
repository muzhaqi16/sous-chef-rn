# `sous-chef/animated-node-takes-no-themed-style`

A node Reanimated animates takes no Unistyles style that reads the theme.

## Reports

An element whose `style` holds an animated style — a `useAnimatedStyle`
binding, or a prop or hook return named `…animated…Style` — and also:

- a `styles.<key>` from a `StyleSheet.create` in the same file whose
  definition reads the factory's `theme` or `rt` parameter, including behind a
  condition or as a dynamic style; or
- a member of a stylesheet imported from another file, whose definition the
  rule cannot read (`StyleSheet.absoluteFill` is exempt).

## Why

Unistyles can drop the first theme change after a node mounts, so a freshly
shown alert card stays on the old theme's surface while its text follows the
new one. On an animated node there is a path that cannot drop it: a
`useAnimatedStyle` that reads `useAnimatedTheme()` re-runs on every theme
change. Evidence and the probe:
[Unistyles can drop a theme change on a freshly mounted animated node](../verified-library-behaviour.md#unistyles-can-drop-a-theme-change-on-a-freshly-mounted-animated-node).

The app moves spacing, radii and the brand colour through `updateTheme`
(density, font scale, high contrast, primary colour), so layout tokens count as
themed too. A key that reads no theme has no Unistyles dependency, so no theme
change can be lost on it.

## Use instead

Themed values go in a `useAnimatedStyle` of their own that reads only
`useAnimatedTheme()`. It re-runs only when the theme changes, so Reanimated does
not re-send the values on every frame of the animation:

```tsx
const animatedTheme = useAnimatedTheme();
const surfaceStyle = useAnimatedStyle(() => {
  const theme = animatedTheme.get();
  return {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
  };
});
const motionStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

<Animated.View style={[styles.card, surfaceStyle, motionStyle]} />;
// styles.card: { position: 'absolute', borderCurve: 'continuous' }
```

Or move the themed style to a non-animated parent or child, as `GlobalBackdrop`
does with its colour and the list rows do with `commonStyles.rowWrapper`.

When the probe stops reproducing, turn this rule off. Code written this way
stays correct either way.

Source: [`eslint/plugin/rules/animated-node-takes-no-themed-style.js`](../../eslint/plugin/rules/animated-node-takes-no-themed-style.js) · spec: [`__tests__/lint/rules/animated-node-takes-no-themed-style.test.ts`](../../__tests__/lint/rules/animated-node-takes-no-themed-style.test.ts)
