# `sous-chef/recycling-list-host-is-bounded`

A recycling list is bounded by the view that hosts it.

## Reports

A `<FlashList>` whose nearest ancestor element is a plain `View` or `Animated.View` that applies no style establishing a height — `height`, `flex`, `flexGrow`, `flexBasis`, or `position: 'absolute'`. Styles reach the check through `styles.x`, an array of them, or an inline object; the `StyleSheet.create` object is resolved in the same file, including through Unistyles' theme callback.

A provider or template is not reported: it renders no view of its own, so its tag says nothing about the height reaching the list.

## Why

FlashList's root is `flex: 1`, so `flexBasis: 0`: it claims the free space its container offers and contributes no height of its own. A `View` that sizes to its children offers nothing to claim, and the list resolves to zero height — **no rows, no error, and nothing a test asserting on data or props can see.**

`FlatList` survives the same container because RN's `ScrollView` base style uses `flexBasis: auto`. That is why swapping one for the other empties a picker that worked.

## Use instead

```tsx
<View style={styles.list}>
  <FlashList data={rows} renderItem={renderItem} />
</View>
// styles.list: { flex: 1 }
```

`minHeight` is not a bound: the view still sizes to its children.

Source: [`eslint/plugin/rules/recycling-list-host-is-bounded.js`](../../eslint/plugin/rules/recycling-list-host-is-bounded.js) · spec: [`__tests__/lint/rules/recycling-list-host-is-bounded.test.ts`](../../__tests__/lint/rules/recycling-list-host-is-bounded.test.ts)
