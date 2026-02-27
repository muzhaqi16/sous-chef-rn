- to regenerate the schema run npm run codegen
- always run npm run typecheck and npm run lint after making code changes to ensure no typescript and linting errors were introduced
- typecasting \_\_typename: 'Mutation' as any, is never needed
- estimatedItemSize has been deprecated in version 2 of flashlist and to never use it which is the version that is app is uisng

### React Compiler Conventions

- **Never write try-catch inside hook/component bodies.** The React Compiler bails out entirely
  on hooks containing try-catch, preventing auto-memoization of all derived values.
  Use the shared helpers from `src/utils/compilerSafeWrappers.ts` instead.
- **Never read/write `ref.current` during render.** Use the "adjusting state during render"
  pattern (`useState` + conditional `setState`) for comparing previous/current values.
- **Hook return objects are auto-memoized by the compiler** — but only if the compiler doesn't
  bail out. Once try-catch is extracted, return objects like `{ actions }` become stable automatically.

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
