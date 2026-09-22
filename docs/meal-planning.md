# Meal Planning

## Overview

Meal plans cover a date range (`WEEKLY` or `MONTHLY` from the create form) and hold
meals, each either a saved recipe or a free-text custom meal, on a date and a
`MealType`. Users complete meals (optionally deducting pantry stock), generate a
shopping list from a plan, duplicate plans, and move between plans and reusable
templates. A plan is personal or linked to a home; home plans sync to other members
through a subscription.

Every write is local-first: it lands in the cache before it fires and replays through
the offline queue (`docs/local-first-architecture.md`).

## Code layout

- `src/features/mealPlan/screens/` — `MealPlanMain` (tab root), `CreateMealPlanScreen`,
  `MealTemplateBuilderScreen`; the two detail screens are registered in
  `screens/registration.ts`, the tab stack is `src/navigation/stacks/MealPlanStack.tsx`.
- `src/features/mealPlan/components/` — sheets, calendar, rows, nutrition cards.
- `src/features/mealPlan/hooks/` — data and write hooks (colocated `.graphql`).
- `src/features/mealPlan/graphql/` — shared operations and fragments.
- `src/features/mealPlan/utils/` — pure derivations (plan ↔ template, duplicate,
  shopping-list derive, permissions).

## MealPlanMain

`MealPlanMain` renders `DeferredScreen`, which paints `MealPlanSkeleton` first and
mounts `MealPlanMainInner` on the deferred render. The skeleton also stays up while the
plan list's first response is in flight.

With no plans, the screen shows `MealPlanEmptyState` ("create" and "create from
template"), or `DataStateView` when the list failed or the device is offline; its retry
refetches the plan list. With plans (pull-to-refresh refetches the shown plan and the
list):

```
Screen  (title = active plan name, tap opens the plan selector;
         actions: OfflineStatusPill, cart, bookmark, ellipsis)
├── WeekStrip | MonthCalendar
├── CalendarToggleBar                 week ↔ month
├── DayMealList                       SwipeAwareScrollComponent + ThemedRefreshControl
│   ├── NutritionSummaryCard          plan nutritionSummary + NutritionGoalProgress
│   ├── EmptyDayState                 selected day has no meals
│   └── MealTypeSection               one per MealType group, "+" adds to that type
│       └── MealPlanItemCard          checkbox, swipe-to-delete, tap → RecipeDetail
├── AddMealSheet
├── SaveAsTemplateSheet
├── TemplateBrowserSheet → TemplatePreviewSheet
├── GenerateShoppingListSheet
├── MealPlanSettingsSheet
├── DuplicatePlanSheet
├── MarkCookedModal                   #components/organisms/MarkCookedModal
└── AnimatedItemSelector              plan selector, MealPlanFilterBar as list header
```

The active plan is resolved by `useActiveMealPlan`: the persisted
`selectedMealPlanId`, then `useMealPlans`' `currentPlan` (active today → nearest
upcoming → most recent), then the first loaded plan. An id whose read comes back null
or forbidden is dropped, cleared from the store and evicted.

Edit controls (tab-bar add button, checkbox, swipe-delete, "+") render only when
`useMealPlanPermissions(plan).canEdit` is true. Permissions follow the home-linked
model in `utils/homeLinkedPermissions.ts`: the owner is `plan.user` (not
`createdBy`); a home `MEMBER` edits but cannot delete.

## Hooks

| Hook                                                              | Purpose                                                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `useMealPlans`                                                    | `GetMealPlans` (`first: 20`, `startDate` desc); materializes `MealPlanDisplay`; derives `currentPlan`                  |
| `useMealPlan`                                                     | `GetMealPlan` for one id, read live through `MealPlanMain_mealPlan`; skipped while the plan's create is unacknowledged |
| `useActiveMealPlan`                                               | Picks the plan the screen shows and retires dead ids (above)                                                           |
| `useMealPlanCalendar`                                             | Selected date, week/month mode, week navigation clamped to the plan's range                                            |
| `useDailyMeals`                                                   | Filters items to the selected day, groups by `MealType`, sorts by name                                                 |
| `useMealPlanItemActions`                                          | Local-first create / toggle-completed / delete of meals                                                                |
| `useMealPlanActions`                                              | Local-first create / update / delete of plans                                                                          |
| `useAddRecipeToMealPlan`                                          | Adds a recipe to a chosen or current plan on a date clamped into its range                                             |
| `useAddToMealPlanSheet`                                           | Public entry point to `AddToMealPlanSheet`, used by `RecipeDetail`                                                     |
| `useDuplicateMealPlan`                                            | Recreates a plan from the cache under new dates                                                                        |
| `useGenerateShoppingList`                                         | Derives a shopping list from the cached plan and writes it local-first                                                 |
| `useShoppingListsForMealPlan`                                     | Lists (`first: 20`) the generate sheet can write into                                                                  |
| `useMealTemplates` / `useMealTemplate` / `useMealTemplateForEdit` | Template list (search + category, paginated), one template grouped by day, the builder's edit read                     |
| `useMealTemplateActions`                                          | Plan from template, template from plan, delete template, duplicate template                                            |
| `useMealTemplateEditor`                                           | Builder writes: create/update template, add/update/remove template items                                               |
| `useMealPlanPermissions`                                          | `canEdit`, `canDelete`, `canDuplicate`, `canGenerateShoppingList`, `canSaveAsTemplate`                                 |
| `useMealPlanSelectorConfig`                                       | Config for the plan selector (rows, create / from template / new template actions)                                     |
| `useMealPlanSubscriptions`                                        | `MealPlanEvents` for the selected home; mounted in `src/app/providers/AuthenticatedSubscriptions.tsx`                  |

## GraphQL

**`graphql/mealPlan.graphql`** — queries `GetMealPlans`, `GetMealPlan`,
`MealPlanForEvent`; mutations `CreateMealPlan`, `UpdateMealPlan`, `DeleteMealPlan`,
`CreateMealPlanItem`, `UpdateMealPlanItem`, `DeleteMealPlanItem`; subscription
`MealPlanEvents`.

**`graphql/mealTemplate.graphql`** — `GetMealTemplates`, `GetMealTemplate`,
`GetMealTemplateForEdit`, `MealTemplateForEvent`; `CreateMealTemplate`,
`UpdateMealTemplate`, `DeleteMealTemplate`, `AddTemplateItem`, `UpdateTemplateItem`,
`RemoveTemplateItem`.

**`hooks/useGenerateShoppingList.graphql`** — `AddDerivedItemsToShoppingList`,
`LinkDerivedListToMealPlan`.

Mutations return result unions (e.g. `CreateMealPlanItemResult = ConflictError |
CreateMealPlanItemPayload | ForbiddenError | NotFoundError | ValidationError`); each
document selects the payload member plus `... on Error { code message }`, `NotFoundError
{ resource resourceId }` and `ValidationError { field }`. Hooks settle them with
`settleMutation` / `appliedPayload`.

**Fragments.** Shared ones live in `graphql/mealPlanFragments.graphql`:
`MealPlanDisplay` (list card), `MealTemplateDisplay`, `MealTemplateItemFragment`. The
rest are colocated with their consumer: `MealPlanMain_mealPlan` / `MealPlanMain_item`,
`MealPlanItemCard_item`, `DailyMeals_item`, `MealPlanItemActions_item`,
`MealPlanSettingsSheet_mealPlan`, `SavedRecipeRow_savedRecipe`,
`useGenerateShoppingList_mealPlan`, `useDuplicateMealPlan_mealPlan`,
`useMealTemplateActions_template`. `GetMealPlan` spreads the screen, settings-sheet,
generate and duplicate fragments; meal-item mutations return the four item fragments so
the cached row stays complete.

**Subscription.** `MealPlanEvents(homeId)` is one stream for plan, plan-item, template
and template-item changes, discriminated by `subtype`. The payload is an envelope plus
`node { id }`, run with `fetchPolicy: 'no-cache'`. Self-echoes are dropped by
originating device. A new plan or template is read back with `MealPlanForEvent` /
`MealTemplateForEvent`; plan and item changes trigger a debounced `GetMealPlan`
refetch, held while a local delete is pending. Personal plans emit no events.

## Data model

`CreateMealPlanItemInput` (from `src/graphql/generated/schema.graphql`):

```graphql
id: ID                 # client-minted CUID2; a replay converges on the existing row
mealPlanId: ID!
date: DateTime!
mealType: MealType!
meal: MealRefInput!    # @oneOf: exactly one of { recipeId: ID } | { customMealName: String }
servings: Int
notes: String
calories: Float        # manual nutrition override; protein, carbs, fat likewise
protein: Float
carbs: Float
fat: Float
estimatedCost: Float
```

`UpdateMealPlanItemInput` adds `isCompleted`, `completedAt`, `deductFromPantry`,
`actualCost` and `usedPantryItems`; its `meal` is optional.

`MealType`: `BREAKFAST`, `BRUNCH`, `LUNCH`, `SNACK`, `DINNER`, `DESSERT` — the order
`useDailyMeals` groups in. Once a day has any meal, the Breakfast, Lunch, Dinner and
Snack sections always show (empty ones included); Brunch and Dessert show only when
they hold a meal.

## User flows

### Creating a plan

`CreateMealPlanScreen` (a `FormScreen`, react-hook-form + yup in
`createMealPlanFormConfig.ts`): name, description, plan type (weekly/monthly; the end
date is derived), start date, servings, budget, "track nutrition" (links the user's
dietary profile), and personal vs a home. It calls `useMealPlanActions().createMealPlan`,
which mints the id, writes the plan plus an empty detail stub to the cache, and marks
the create unconfirmed so `useMealPlan` skips its query until the server acknowledges
it. A refusal naming `name` or `startDate` is set on that field; others alert. The
screen can also start from a template.

Entry points: the empty state, and the plan selector's actions (create, create from
template, new template).

### Adding a meal on the Meal Plan tab

1. Pick a date on `WeekStrip` / `MonthCalendar`.
2. Open `AddMealSheet` from the tab-bar add button (defaults to `DINNER`), a section's
   "+" (pre-selects that type), or `EmptyDayState`.
3. The sheet shows:
   - meal-type chips;
   - a `SearchBar` (500 ms debounce);
   - the user's saved recipes from `useSavedRecipes`, paginated on scroll (`hasMore` /
     `loadMore`) while the query is empty and filtered client-side by name with
     `filterByTerm`;
   - once the query is non-empty, an "add custom" row that calls `onAddCustomMeal`;
   - at 3+ characters, Spoonacular results (10, cached in `useRecipeCacheStore`, the
     previous request aborted). Picking one fetches its full information, imports it
     through `useRecipePreload`, then adds the imported recipe;
   - `EmptyState` for no saved recipes or no results.
4. `MealPlanMain` calls `createItem` with `meal: { recipeId }` or
   `meal: { customMealName }` and the selected date.

### Adding a recipe from RecipeDetail

`RecipeDetail` has an "Add to meal plan" header action that opens
`AddToMealPlanSheet` via `useAddToMealPlanSheet`. The sheet shows a plan chip row when
there is more than one plan, a `WeekStrip` limited to the chosen plan's range and
meal-type chips, and adds through `useAddRecipeToMealPlan`. Without a plan it shows a
warning and disables Add.

### Completing a meal

Checking a recipe meal opens `MarkCookedModal` (servings, deduct from pantry, notes);
checking a custom meal or unchecking toggles directly. `toggleCompleted` writes
`isCompleted` / `completedAt` to the cache, records the flag in
`optimisticDataPersistence` until the server confirms, then sends
`UpdateMealPlanItem` (with `deductFromPantry`, `servings` and `notes` only when
completing). The success toast says pantry items were deducted when a recipe meal was
completed with deduction. A completed meal with `usedPantryItems` shows a "pantry
updated" badge.

### Deleting a meal

Swipe-to-delete on `MealPlanItemCard`. The row is removed from `mealPlanItems` and
evicted before the mutation, registered as a pending delete so a subscription echo
cannot re-add it, and restored if the server refuses.

### Generating a shopping list

The cart icon (or the settings sheet) opens `GenerateShoppingListSheet`: check pantry
(default on), new list with an optional name, or an existing list.
`useGenerateShoppingList` derives the lines on the client
(`utils/deriveShoppingListFromMealPlan.ts`) from the cached
`useGenerateShoppingList_mealPlan` read:

- ingredients are scaled by meal servings ÷ recipe servings;
- lines aggregate on catalog item + exact unit;
- custom meals, recipes with no ingredients, and ingredients without a catalog item or
  unit are skipped and reported;
- pantry coverage uses the cache-only pantry read; with no cached pantry it is not
  checked and a toast says so.

It then creates the list, writes optimistic rows, sends `AddDerivedItemsToShoppingList`,
and for a new list `LinkDerivedListToMealPlan` — all local-first.

### Templates

- **Save plan as template** — bookmark icon → `SaveAsTemplateSheet` (name, description,
  category, tags). `createTemplateFromPlan` converts dates to day offsets
  (`utils/templateFromPlan.ts`) and creates the template local-first.
- **Plan from template** — `TemplateBrowserSheet` (search, category chips, paginated)
  → `TemplatePreviewSheet` (plan name, start date, servings, day-by-day preview, or
  `DataStateView` with a retry when the template read failed) →
  `createPlanFromTemplate`, which creates a `WEEKLY` plan and one `CreateMealPlanItem`
  per template meal (`utils/planFromTemplate.ts`).
- **Author / edit** — `MealTemplateBuilderScreen` (`templateId` param for edit): template
  metadata plus a sub-form adding meals by day offset, meal type, custom name and
  servings. In create mode meals are drafts sent with `CreateMealTemplate`; in edit mode
  each change is its own template-item mutation.

Derived copies skip a meal that names neither a recipe nor a custom name and report the
count in a toast.

### Plan settings and duplicate

`MealPlanSettingsSheet` shows the home, creator, budget and spend, and offers:
generate shopping list, duplicate (if `canDuplicate`), show nutrition, toggle nutrition
tracking (when the user has a dietary profile) and delete (if `canDelete`, confirmed by
alert). It also lists the plan's generated shopping lists.

`DuplicatePlanSheet` proposes "Copy of …" starting the day after the plan ends with the
same duration. `useDuplicateMealPlan` reads the plan from the cache, creates the new
plan, then fires one `CreateMealPlanItem` per meal with dates shifted by the same
offset.

### Plan selector

Tapping the header title opens `AnimatedItemSelector` with the loaded plans (name,
date range, type, home or "personal"). `MealPlanFilterBar` filters that list
client-side (name search, active only, weekly/monthly) without changing the active plan.

## Limitations

- **A planned meal cannot be edited.** Its servings, notes, date and meal type are set
  when it is added; changing one means deleting the meal and adding it again.
- **Saved-recipe search in `AddMealSheet` covers loaded pages only.** Filtering is
  client-side and pagination is suspended while a query is entered.
- **The template builder authors custom meals only.** It has no recipe picker, and
  saving an edited item sends `meal: { customMealName }`.

## Key files

| File                                                                         | Role                                                     |
| ---------------------------------------------------------------------------- | -------------------------------------------------------- |
| `src/features/mealPlan/screens/MealPlanMain.tsx`                             | Tab root: calendar, day list, every sheet, plan selector |
| `src/features/mealPlan/screens/CreateMealPlanScreen.tsx`                     | Create-plan form                                         |
| `src/features/mealPlan/screens/MealTemplateBuilderScreen.tsx`                | Create / edit a template                                 |
| `src/features/mealPlan/components/AddMealSheet.tsx`                          | Saved recipes, custom meal, Spoonacular search           |
| `src/features/mealPlan/components/AddToMealPlanSheet/AddToMealPlanSheet.tsx` | Add a given recipe to a plan, date and meal type         |
| `src/features/mealPlan/components/DayMealList.tsx`                           | Day view grouped by meal type                            |
| `src/features/mealPlan/components/MealPlanItemCard.tsx`                      | Meal row: completion, delete, nutrition and pantry badge |
| `src/features/mealPlan/hooks/useMealPlanItemActions.ts`                      | Local-first meal writes                                  |
| `src/features/mealPlan/hooks/useMealPlanActions.ts`                          | Local-first plan writes                                  |
| `src/features/mealPlan/hooks/useActiveMealPlan.ts`                           | Active plan resolution                                   |
| `src/features/mealPlan/hooks/useGenerateShoppingList.ts`                     | Client-derived shopping list                             |
| `src/features/mealPlan/hooks/useMealTemplateActions.ts`                      | Plan ↔ template conversions                              |
| `src/features/mealPlan/hooks/useMealPlanSubscriptions.ts`                    | Home meal-plan event stream                              |
| `src/features/mealPlan/graphql/mealPlan.graphql`                             | Plan and meal operations, subscription                   |
| `src/features/mealPlan/graphql/mealTemplate.graphql`                         | Template operations                                      |
| `src/features/mealPlan/graphql/mealPlanFragments.graphql`                    | Shared plan and template fragments                       |
| `src/features/recipes/hooks/useSavedRecipes.ts`                              | Saved recipes (paginated), read by `AddMealSheet`        |
| `src/features/recipes/screens/RecipeMain.tsx`                                | Recipe discovery and Spoonacular search                  |
| `src/features/recipes/screens/RecipeDetail/index.tsx`                        | Recipe detail, incl. "Add to meal plan"                  |
