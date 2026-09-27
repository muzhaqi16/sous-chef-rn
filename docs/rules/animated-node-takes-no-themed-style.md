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

Reanimated renders its host with React-side copies of the values it animates:
each animated style's initial value, then its settled-props snapshot. Unistyles
links every plain object in the style array to the node. When a theme rebuild
reaches the node, Unistyles writes all of them back through commits Reanimated
does not correct, and the node shows the stale copy until its next React
re-render. The global dim flickered off at the end of every sheet open this
way. Mechanism, versions and upstream issues:
[Unistyles re-applies reanimated's React-side value](../verified-library-behaviour.md#unistyles-re-applies-reanimateds-react-side-value-over-an-animation).

A key that reads no theme has no Unistyles dependency, so no theme rebuild
ever reaches the node.

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

If Unistyles or Reanimated fixes this upstream, turn this rule off. Code
written this way stays correct either way.

Source: [`eslint/plugin/rules/animated-node-takes-no-themed-style.js`](../../eslint/plugin/rules/animated-node-takes-no-themed-style.js) · spec: [`__tests__/lint/rules/animated-node-takes-no-themed-style.test.ts`](../../__tests__/lint/rules/animated-node-takes-no-themed-style.test.ts)
