# API requests from the client

What the client needs from `sous-chef-api` and cannot express today. The API
repo is read-only from here, so this file is the channel: one section per gap,
each naming the client work it blocks and what a sufficient answer looks like.
Delete a section once the schema carries it.

Not a design document. It says what the client is trying to do and what it is
missing, not how the server should model it.

## Open

Nothing. The three gaps this file carried are answered below, with the client
work each one leaves.

## Answered — what the API now does, and what the client must change

All three sections were confirmed against the server and fixed there. Two were
server defects; the third was a missing mutation. No database migration was
needed, and every schema change is additive.

### Recipe ingredients keep their unit

**Was:** the ingest path read the flat `usUnit`/`metricUnit` fields, which the
typed mirror replaced, so `resolveUnitId` was handed `undefined` and every
ingredient imported through the documented contract was written with
`unitId: null` — silently, with nothing in the logs. Both the meal-plan and the
deficit paths skip a null-unit ingredient, which is why a derived list came back
empty.

**Now:** one seam reads every carrier a client may use — `unitId`, the flat
fields, `measurements`, `externalSources[].spoonacular.unit` and
`spoonacular.measures` — and takes the QUANTITY and the UNIT from the same
measure. Spelling resolution goes through the seeded unit vocabulary by name,
symbol or alias, so `tbs`, `floz` and `fl. oz.` resolve; a spelling it does not
know still leaves `unitId` null rather than minting a unit with an invented
conversion factor. Existing null-unit rows are repaired from the verbatim
payload stored beside them.

**A defect worth knowing about, because the client has data shaped by it:**
`amount` pairs with `unit`, **not** with `measures.us`. A metric-authored recipe
sends `amount: 200, unit: "g"` alongside `measures.us: { amount: 7.05,
unitShort: "oz" }`. The old flat contract took the unit from `measures.us` while
the quantity stayed `amount`, so a 200 g ingredient was stored as 200 oz — a 28×
error. Anything that pairs an amount with a unit from a different measure has
this bug.

**Client work:**

1. `toRecipeInput.ts:132-133` derives `spoonacular.unitShort`/`unitLong` from
   `measures.us`. Send the ingredient's own `unitShort`/`unitLong` where the
   response carries them, falling back to `measures.us`. Keep sending `unit`
   verbatim and both measures whole — the server persists both systems now.

### Both unit systems come back, and reads follow the user's preference

The us and metric measures are stored on
`RecipeIngredient.externalSources[].metadata` as `usAmount` / `usUnit` /
`metricAmount` / `metricUnit`. That field is already in the schema — no client
codegen change is needed to read it.

For the caller's own preference there is a new field:

```graphql
RecipeIngredient.convertedQuantity: ConvertedValue   # { value, unit }
```

Viewer-scoped: it resolves through `UserSettings.preferredUnitSystem` (falling
back to locale for `SYSTEM`), so two callers reading one recipe get different
answers, and it is pinned out of the shared cache. Null when the ingredient
names no unit. It works for hand-written recipes too, which have no mirror.

**Client work:**

2. `IngredientCard.tsx:38-40` renders `ingredient.unit?.symbol` for a saved
   recipe and hardcodes `measures.us.unitShort` for a preview. Render
   `convertedQuantity` for the saved case, falling back to `quantity`/`unit`;
   for the un-saved preview pick `measures.metric` vs `measures.us` by
   `preferredUnitSystem` instead of always US.
3. `useRecipeShoppingList.ts:147-148` and `:470-471` send
   `unit.unitName` from `measures.us.unitShort` when adding recipe ingredients
   to a list, discarding the metric measure. Send the measure matching the
   user's `preferredUnitSystem`, or omit `unit` entirely and let the server
   resolve it from the ingredient row.

### Pantry deduction converts before it subtracts

**Was:** the deduction selected pantry rows whose unit had the same TYPE as the
ingredient's and summed their raw quantities, then computed the deficit with the
ingredient's unit id on both sides — so nothing ever converted. 500 ml counted
as 500 against a 2-litre requirement and the line was dropped as covered.

**Now:** every stack is converted into the ingredient's unit through the item's
own conversions, its density and its net weight. A stack no conversion reaches
is left out of the total and reported rather than counted. Two ingredients
naming one catalog item no longer each spend the whole stock: what the first
takes is held against the second, in the unit it was taken in.

**Client work:** none. The client's exact-unit-id deduction is still a safe
subset — it can over-buy, never under-buy — but the two now agree wherever a
conversion exists, so the divergence this repo works to avoid is gone.

### A derived shopping list can record its meal plan

New mutation:

```graphql
linkShoppingListToMealPlan(input: LinkShoppingListToMealPlanInput!):
  LinkShoppingListToMealPlanResult!
```

`LinkShoppingListToMealPlanInput` is `{ id: ID!, mealPlanId: ID! }`, where `id`
is the shopping list. It sets `ShoppingList.mealPlanId` and
`generatedFromMealPlan`, which is what `MealPlan.generatedShoppingLists` rolls
up from — so the "Generated lists" section on the meal plan settings sheet fills
in. Both ends are checked: edit access to the list, view access to the plan.

**Client work:**

4. `createShoppingList` → `addItemsToShoppingList` → `linkShoppingListToMealPlan`
   as a third queued write. It is idempotent, so a replay is harmless.

## Not planned

`possibleUnits`, `shoppingListUnits` and `categoryPath` stay server-owned. They
live only on `GET /food/ingredients/{id}/information`, which is one call per
ingredient and would blow the quota — the decision not to call it stands. Send
them only if that call is ever made for another reason.
