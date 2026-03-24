- to regenerate the schema run npm run codegen
- always run npm run typecheck and npm run lint after making code changes to ensure no typescript and linting errors were introduced
- typecasting \_\_typename: 'Mutation' as any, is never needed
- estimatedItemSize has been deprecated in version 2 of flashlist and to never use it which is the version that is app is uisng
- **Never use `InteractionManager` from `react-native`.** It has been deprecated. Avoid long-running work on the JS thread and use `requestIdleCallback` instead for deferring non-urgent tasks.

### React Compiler Conventions

- **Do not use `useMemo` or `useCallback`.**  The `babel-plugin-react-compiler` plugin automatically
  memoizes values and callbacks. Manual `useMemo`/`useCallback` is redundant and should not be added.
- **Never write try-catch or try-finally inside hook/component bodies.** The React Compiler
  bails out entirely on hooks containing try-catch **or try-finally**, preventing
  auto-memoization of all derived values. The `react-compiler/react-compiler` ESLint rule
  has a [known bug](https://github.com/facebook/react/issues/35644) where it **silently
  stops reporting all diagnostics** when encountering unsupported syntax like `finally` —
  producing zero warnings instead of flagging the bailout. The `react-hooks/todo` rule
  catches these silent bailouts. Use the shared helpers from `src/utils/compilerSafeWrappers.ts`
  instead.
- **Never read/write `ref.current` during render.** Use the "adjusting state during render"
  pattern (`useState` + conditional `setState`) for comparing previous/current values.
- **Hook return objects are auto-memoized by the compiler** — but only if the compiler doesn't
  bail out. Once try-catch is extracted, return objects like `{ actions }` become stable automatically.
- **`React.memo` is unnecessary for most components** — the compiler caches JSX elements at the
  parent call site, making `React.memo` redundant. **Exception: FlashList/FlatList `renderItem`
  components** still need `React.memo` because the parent call site is either module-scope
  (not compiled) or library internals (not compiled), so there is no compiled parent to cache
  the element. Custom comparators doing value-equality on nested fields (via `createPropsComparator`)
  remain valuable since the compiler only uses reference equality (`===`).

### `scheduleOnRN` Worklet Convention

Functions passed to `scheduleOnRN` (Reanimated's `runOnJS` replacement) **must be pre-defined
in RN runtime scope**. Inline arrow/function expressions inside worklets cause native crashes
on Android because the worklet serializer cannot capture closures created at call-site.

```ts
// CORRECT — callback defined in RN scope
const handlePress = (id: string) => { /* ... */ };
const gesture = Gesture.Tap().onEnd(() => {
  scheduleOnRN(handlePress)(id);
});

// WRONG — inline function crashes on Android
const gesture = Gesture.Tap().onEnd(() => {
  scheduleOnRN(() => handlePress(id))();  // native crash
});
```

**Never pass function references as arguments to `scheduleOnRN`.** Functions cannot be
serialized across the worklet boundary — they arrive as plain objects in release mode,
causing `TypeError: Object is not a function`. Only pass primitives (strings, numbers,
booleans). Capture function dependencies via RN-scope closure instead:

```ts
// CORRECT — capture onDismiss via closure, pass only primitives
const handleDismiss = () => { onDismiss(id); };
scheduleOnRN(handleDismiss);

// WRONG — passing a function reference through the worklet boundary
scheduleOnRN(dismissEntry, onDismiss, id);  // onDismiss is an object in release
```

Two ESLint `no-restricted-syntax` rules enforce this at lint time:
1. No inline functions as the first argument
2. No more than 2 arguments (prevents passing function refs as extra args)

### Cache Persistence — Raw Apollo State

The Apollo cache is persisted to MMKV as-is via `cache.extract()` / `cache.restore()`
in `ApolloCachePersistence.ts`. No transformation is applied — connection fields (`edges`,
`pageInfo`) are preserved so queries can be satisfied from cache immediately on cold start.

**What gets persisted:** The full normalized cache — entities (`PantryItem:123`,
`ShoppingListItem:456`), connection wrappers (`itemsConnection`, `membersConnection`),
and `ROOT_QUERY`. On restore, queries return cached data instantly.

**Stale data handling:** The default `cache-and-network` watchQuery policy fires a
background network request on every mount. Stale `pageInfo` or edges from a previous
session are automatically replaced within seconds. A brief flash of stale pagination
state (e.g., "load more" visible when no more items exist) is acceptable — it
self-corrects when the network response arrives.

**When adding new paginated connections:**
- Use `itemsConnectionFieldPolicy()` or `mergeConnectionByNodeId()` for merge logic
- Use `extractNodes()` / `normalizeConnection()` helpers which return `[]` for missing edges
- Use `cache-and-network` → `cache-first` fetch policy so the network fires immediately on restore

### Autocomplete Local-First Search

All autocomplete hooks use `useAutocompleteSearch` from `src/hooks/ui/useAutocompleteSearch.ts`.
When a hook provides `fallbackItems` + `filterFallback`, it can opt into **local-first** search
by passing `localFirst: true`. This filters cached/local items first and only fires the API
if no local matches exist — eliminating unnecessary network requests for common lookups.

**Current status:**

| Hook                             | `localFirst` | Notes                                       |
|----------------------------------|:------------:|---------------------------------------------|
| `useUnitAutocomplete`            | `true`       | Uses `cachedUnits` from Zustand             |
| `useBrandAutocomplete`           | `false`      | Has `suggestedBrands` fallback — ready to opt in when desired |
| `useCategoryAutocomplete`        | `false`      | No cached data yet — add when categories are cached |
| `useItemAutocomplete`            | `false`      | No cached data yet — add when items are cached |
| `useStorageLocationAutocomplete` | N/A          | Fully local, doesn't use `useAutocompleteSearch` |

When adding cached data to a new autocomplete hook, pass `localFirst: true` along with
`fallbackItems` and `filterFallback` to enable local-first behavior.

### Verification Commands

After implementing fixes, run:

```bash
npm run typecheck  # Verify TypeScript changes
npm run lint       # Verify code quality
npm test           # Run test suite
```
