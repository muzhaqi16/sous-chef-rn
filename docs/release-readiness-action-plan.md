# Release Readiness — Remaining Actions (PR #166: dev → main)

## 4. P3 hygiene (cheap; optional this PR)

- [x] Fix stale shared-fragment header `recipeFragments.graphql:57-58` (lists deleted `SuggestedRecipes` / renamed `FavoriteRecipe`; missing `ForkRecipe`).
- [x] Delete orphaned `src/features/pantry/hooks/mutations/useOpenPantryItem.generated.ts`.
- [x] Stale comments: `InvitationAcceptanceModal.test.tsx:138` (`refetchQueries` no longer used); `ShoppingListMainContent.tsx:65` (nonexistent `React.memo`).
- [x] Initial recipe text-search stale-response guard (`useRecipeScreen.tsx:338-390`).
- [ ] Plan the RNFB `requestPermission` / `AuthorizationStatus` deprecation migration (the 3 lint warnings).
- [ ] Schedule the gesture-handler 3.x migration before nav v8 beta forces it.
