# Meal Planning Feature

## Overview

The meal planning feature allows users to create weekly meal plans, assign recipes to specific days and meal types, track meal completion, and generate shopping lists from their plans. Users can also save plans as reusable templates.

## Architecture

### Screen & Component Hierarchy

```
MealPlanMain (screen)
├── MealPlanHeader
├── WeekStrip / MonthCalendar (date selection)
├── DayMealList
│   ├── MealTypeSection (per meal type group)
│   │   └── MealItem (individual meal row)
│   └── "Add a meal" button
├── MealPlanEmptyState (when no plans exist)
└── Bottom Sheets
    ├── AddMealSheet (select saved recipe)
    ├── SaveAsTemplateSheet
    ├── TemplateBrowserSheet
    ├── TemplatePreviewSheet
    ├── GenerateShoppingListSheet
    ├── MealPlanSettingsSheet
    └── DuplicatePlanSheet
```

### Hooks

| Hook | Purpose |
|------|---------|
| `useMealPlans` | Fetches paginated list of plans; derives `currentPlan` (the plan spanning today) |
| `useMealPlan` | Fetches a single plan by ID with full item list and nutrition summary |
| `useDailyMeals` | Pure computation — filters and groups items for a selected date |
| `useMealPlanItemActions` | Wraps create/update/delete/toggle mutations for meal plan items |
| `useMealTemplateActions` | Create templates from plans and plans from templates |
| `useGenerateShoppingList` | Generates a shopping list from a meal plan |
| `useDuplicateMealPlan` | Duplicates an existing meal plan |
| `useSavedRecipes` | Fetches user's saved (favorited) recipes — used by `AddMealSheet` |
| `useMealPlanCalendar` | Manages week/month view mode, selected date, and week navigation |

### GraphQL Operations

Defined in `src/graphql/operations/mealPlan/mealPlan.graphql`.

**Queries:**

| Query | Description |
|-------|-------------|
| `GetMealPlans` | Paginated list with `MealPlanDisplay` fragment. Supports `filters` and `orderBy`. |
| `GetMealPlan($id)` | Single plan with `MealPlanFull` fragment (includes items and nutrition summary) |

**Mutations:**

| Mutation | Description |
|----------|-------------|
| `CreateMealPlan` | Create a new meal plan |
| `UpdateMealPlan` | Update plan metadata |
| `DeleteMealPlan` | Delete a plan |
| `CreateMealPlanItem` | Add a recipe or custom meal to a plan |
| `UpdateMealPlanItem` | Update an item's fields |
| `DeleteMealPlanItem` | Remove an item from a plan |
| `DuplicateMealPlan` | Clone an existing plan |
| `GenerateShoppingListFromMealPlan` | Create a shopping list from plan items |

All mutations return a standard payload: `{ success, message, code, <entity> }`.

**Fragments:**

- `MealPlanDisplay` — scalar fields of a plan (no items)
- `MealPlanFull` — extends Display + `dietaryProfile`, `mealPlanItems`, `generatedShoppingLists`, `nutritionSummary`
- `MealPlanItemFragment` — full item with nested `BasicRecipeFragment`

## Data Model

### `CreateMealPlanItemInput`

```graphql
mealPlanId: ID!           # Required — which plan
date: DateTime!            # Required — which day
mealType: MealType!        # Required — Breakfast | Brunch | Lunch | Snack | Dinner | Dessert
recipeId: ID               # Optional — reference to a saved recipe
customMealName: String     # Optional — free-text meal name (alternative to recipeId)
servings: Int              # Optional
notes: String              # Optional
calories: Float            # Optional — manual nutrition override
protein: Float             # Optional
carbs: Float               # Optional
fat: Float                 # Optional
estimatedCost: Float       # Optional
```

A meal plan item is either a **recipe-based** item (`recipeId` set) or a **custom meal** (`customMealName` set).

### `MealPlanItemFragment` fields

`id`, `date`, `mealType`, `isCompleted`, `completedAt`, `customMealName`, `servings`, `notes`, `calories`, `protein`, `carbs`, `fat`, `estimatedCost`, `actualCost`, `nutritionSource`, `usedPantryItems`, `recipe { ...BasicRecipeFragment }`

### Meal Types (display order)

`Breakfast` → `Brunch` → `Lunch` → `Snack` → `Dinner` → `Dessert`

## User Flows

### Creating a Meal Plan

1. User navigates to the Meal Plan tab
2. If no plans exist, `MealPlanEmptyState` is shown with options to create a new plan or browse templates
3. User taps "Create Plan" → navigates to `CreateMealPlan` screen
4. Alternatively, user can create a plan from a template via `TemplateBrowserSheet` → `TemplatePreviewSheet`

### Adding a Saved Recipe to a Meal Plan

This is the primary flow for populating a meal plan:

1. User selects a date on the `WeekStrip` or `MonthCalendar`
2. User taps "Add a meal" (global button at bottom) or the "+" within a specific meal type section
3. `AddMealSheet` opens as a bottom sheet
   - If opened from a meal type section, that meal type is pre-selected
   - Otherwise defaults to `Dinner`
4. Sheet displays all of the user's **saved recipes** (via `useSavedRecipes`)
5. User can type in the search bar to **client-side filter** recipes by name (case-insensitive substring match)
6. User selects a meal type chip if needed (`Breakfast` | `Brunch` | `Lunch` | `Snack` | `Dinner` | `Dessert`)
7. User taps a recipe row → `onAddRecipe(recipeId, mealType)` is called
8. `MealPlanMain.handleAddRecipe` calls `createItem({ mealPlanId, recipeId, mealType, date })` and closes the sheet
9. `GetMealPlan` is refetched to update the daily view

### Recipe Discovery → Save → Add to Plan Journey

Since `AddMealSheet` only shows saved recipes, a user must discover and save a recipe before it can be added to a meal plan:

1. **Discover** — User finds a recipe via:
   - `RecipeSearch` screen (external search via Spoonacular API)
   - `RecipeMain` screen (random suggestions and saved recipe browsing)
2. **Save** — User taps the save/heart/folder icon on `RecipeDetail` → recipe is stored in backend
3. **Add to Plan** — User navigates to the Meal Plan tab, opens `AddMealSheet`, and selects the now-saved recipe

### Completing a Meal

1. User taps the checkbox on a meal item in `DayMealList`
2. `toggleCompleted(id, isCompleted, hasRecipe)` is called
3. The mutation sets `isCompleted` and `completedAt`
4. If the meal has a recipe, a toast shows "Meal completed! Pantry items deducted."
5. `GetMealPlan` is refetched

### Generating a Shopping List

1. User taps the cart icon in the meal plan header
2. `GenerateShoppingListSheet` opens
3. User confirms generation
4. `GenerateShoppingListFromMealPlan` mutation runs, returning `{ id, name, totalItems }`

### Saving as Template / Using Templates

- **Save as template**: Bookmark icon in header → `SaveAsTemplateSheet`
- **Browse templates**: From empty state CTA or three-dot settings menu → `TemplateBrowserSheet` → `TemplatePreviewSheet`
- **Duplicate plan**: From `MealPlanSettingsSheet` → `DuplicatePlanSheet`

## Daily Meals Processing (`useDailyMeals`)

This hook is a pure computation layer that takes the full item list and selected date:

1. Filters items to those matching the selected date (`date-fns` `isSameDay`)
2. Groups items by `MealType` in canonical display order
3. Sorts items within each group alphabetically by `recipe.name ?? customMealName`
4. Drops empty groups

Returns: `dailyMeals` (non-empty `MealTypeGroup[]`), `totalMeals`, `totalCalories`, `isEmpty`

## Cache & Refetch Strategy

- **Create/Delete item**: Refetches `GetMealPlan` with the active plan ID (full item list reload)
- **Toggle completed**: Refetches `GetMealPlan` as a runtime option
- **Generic update**: No automatic refetch — callers manage cache manually
- No optimistic updates are used in the meal plan flow

## Current Limitations & Gaps

### AddMealSheet only shows saved recipes

The `AddMealSheet` uses `useSavedRecipes()` to load recipes. There is no external/API recipe search within the sheet. Users must save a recipe first (via `RecipeDetail`), then navigate to the meal plan to add it. The search bar performs client-side filtering only (case-insensitive name match, no debounce).

### No "Add to Meal Plan" action from recipe screens

`RecipeDetail` offers save, add-to-shopping-list, and mark-as-cooked actions, but has no "Add to Meal Plan" option. Similarly, `RecipeSearch` has no meal plan integration. Users must always go through the Meal Plan tab's `AddMealSheet`.

### Custom meal UI not implemented

The backend fully supports `customMealName` on `CreateMealPlanItemInput`, and `MealPlanMain` defines a `handleAddCustomMeal` callback that passes `onAddCustomMeal` to `AddMealSheet`. However, `AddMealSheet` discards this prop (aliased as `_onAddCustomMeal`) — there is no text input or button for entering a custom meal name.

### No loading or empty states in AddMealSheet

`AddMealSheet` does not show a loading indicator while `useSavedRecipes` is fetching, nor does it handle the case where the user has no saved recipes with a helpful message.

### No pagination for saved recipes

`useSavedRecipes` fetches all recipes in a single request with no cursor-based pagination. This may become a performance issue for users with large recipe collections.

### `selectedDate` prop unused in AddMealSheet

The `selectedDate` prop is passed to `AddMealSheet` but aliased as `_selectedDate` and not used. The date context is only used upstream by `MealPlanMain` when calling `createItem`.

### Nutrition calculation caveat

`useDailyMeals` sums `item.calories` directly without adjusting for `servings`. If an item's serving count differs from the recipe default, the calorie total may be inaccurate.

## Key Files Reference

| File | Role |
|------|------|
| `src/screens/mealPlan/MealPlanMain.tsx` | Main meal plan screen — orchestrates sheets, hooks, and navigation |
| `src/components/mealPlan/AddMealSheet.tsx` | Bottom sheet for adding meals (saved recipes only, client-side search) |
| `src/components/mealPlan/DayMealList.tsx` | Renders daily meals grouped by meal type with add-meal buttons |
| `src/hooks/mealPlan/useMealPlanItemActions.ts` | Create/update/delete/toggle mutations for meal plan items |
| `src/hooks/mealPlan/useMealPlans.ts` | Fetch paginated list of meal plans; derive current plan |
| `src/hooks/mealPlan/useMealPlan.ts` | Fetch single plan with items and nutrition summary |
| `src/hooks/mealPlan/useDailyMeals.ts` | Filter and group items for a selected date (pure computation) |
| `src/hooks/mealPlan/useMealPlanCalendar.ts` | Week/month view state and date navigation |
| `src/hooks/recipe/useSavedRecipes.ts` | Fetch user's saved recipes (consumed by AddMealSheet) |
| `src/screens/recipe/RecipeMain.tsx` | Saved recipes + random recipe suggestions |
| `src/screens/recipe/RecipeSearch/index.tsx` | External recipe search via Spoonacular API |
| `src/screens/recipe/RecipeDetail/index.tsx` | Recipe detail — save, shopping list, mark cooked (no meal plan action) |
| `src/graphql/operations/mealPlan/mealPlan.graphql` | GraphQL queries and mutations for meal plans and items |
