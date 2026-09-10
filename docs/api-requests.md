# API requests from the client

What the client needs from `sous-chef-api` and cannot express today. The API
repo is read-only from here, so this file is the channel: one section per gap,
each naming the client work it blocks and what a sufficient answer looks like.
Delete a section once the schema carries it.

Not a design document. It says what the client is trying to do and what it is
missing, not how the server should model it.

## A shopping list a client derives cannot record the meal plan it came from

**Blocks:** making "generate a shopping list from this meal plan" work offline.

`generateShoppingListFromMealPlan` is a server fan-out: one call reads the
plan's recipes, aggregates their ingredients, deducts the pantry, creates the
list and adds every line. Offline the client has none of that, so the client is
moving to the primitives the same action decomposes into — `createShoppingList`
followed by `addItemsToShoppingList` — which queue and replay like every other
offline write.

Two fields the fan-out sets are unreachable that way. `ShoppingList.mealPlanId`
and `ShoppingList.generatedFromMealPlan` are written inside the fan-out's own
transaction, and no client-reachable input carries either:

- `CreateShoppingListInput` has `name`, `description`, `homeId`, `isDefault`,
  `budgetAmount`, `tags`, `id` — no meal plan.
- `UpdateShoppingListInput` has no meal plan field either.
- There is no `linkShoppingListToMealPlan` mutation.

`BatchAddShoppingListItemInput.recipeContext` does carry `mealPlanId` per LINE,
so per-item provenance survives — but `MealPlan.generatedShoppingLists` rolls up
from the list's own column, not from its items, so it comes back empty. The
client renders that rollup as a "Generated lists" section on the meal plan
settings sheet, and for a derived list the section would be empty while the
lines themselves are correctly marked meal-plan-sourced.

**A sufficient answer:** any client-reachable way to set the link at or after
creation — a field on the create input, a field on the update input, or a
dedicated link mutation. The client can send it as a separate queued write if it
has to; what it cannot do is leave the association unexpressible.

## Pantry deduction sums quantities across units it never converts

**Affects:** what a derived shopping list has to deliberately not copy.

`generateShoppingListFromMealPlan` deducts pantry stock per aggregated
ingredient. It selects the pantry rows whose catalog item matches AND whose unit
has the same TYPE as the ingredient's unit, then sums their raw quantities:

```ts
if (pantryItem.unit?.type === entry.unitType && pantryItem.unitId) {
  totalAvailable += pantryItem.quantity;
}
```

The rows are only type-compatible at that point, not the same unit, and the
deficit is then computed with the ingredient's unit id on BOTH sides:

```ts
const deficit = await quantityOps.calculateDeficit(
  quantityToAdd,
  entry.unitId,
  totalAvailable,
  entry.unitId,
  entry.itemId,
);
```

So a pantry holding 500 ml counts as 500 against an ingredient needing 2 litres,
and the line is dropped as fully covered. The type match is what makes the rows
eligible; nothing converts them.

The client deducts on the exact unit id instead, which is a subset of the rows
the server takes and needs no conversion. That is the safe direction — a derived
list can over-buy, never under-buy — but it means a plan generated on the server
and the same plan derived on the client will not always produce the same
quantities, which is the divergence this repo otherwise works hard to avoid.

**A sufficient answer:** convert before subtracting, so the available total is
expressed in the ingredient's unit. The client can then match the rule exactly,
since `Unit.type` is already selectable and both sides would agree.

## Imported recipe ingredients lose their unit

**Blocks:** generating a shopping list from a meal plan at all, for any recipe
imported since 2026-06-14.

Spoonacular sends units. Its `extendedIngredients` entries carry `unit`,
`unitShort`, `unitLong` and a `measures` object with `us` and `metric` variants,
and `SpoonacularIngredientPayload` in the API models every one of them.

The client sends them too, inside the typed mirror:

```ts
spoonacular: {
  unit: ing.unit,
  unitShort: ing.measures?.us?.unitShort,
  measures: { us: { unitShort: … }, metric: { unitShort: … } },
}
```

The server resolves the unit from somewhere else. `prepareIngredientForPersist`
reads the flat carriers only:

```ts
unitId = await this.getService(UnitService).resolveUnitId(
  ingredient.usUnit ?? ingredient.metricUnit,
);
```

`usUnit` and `metricUnit` are not sent. The client used to send
`usUnit: ing.measures?.us?.unitShort` and dropped it when it moved to the typed
mirror. So `resolveUnitId` is handed `undefined`, returns before its
"Unrecognized unit string" log line, and every ingredient imported since is
written with `unitId: null` — silently, with nothing in the logs.

The evidence is visible in the app. A recipe imported before that change shows
"28 oz canned tomatoes" and "0.5 lb mushrooms". One imported today shows
"8 rotini" and "1 olive oil", from a source recipe that reads "8 ounces
whole-wheat rotini" and "1 tablespoon extra-virgin olive oil".

This is why a derived shopping list comes back empty. Both implementations skip
an ingredient with no unit — the server's own fan-out does
`if (!ingredient.itemId || !ingredient.unitId) continue;` — so the server has
been generating empty lists from these recipes too.

**A sufficient answer:** resolve the unit from the typed mirror the client
actually sends, and backfill the existing null rows. The source strings were
never lost — the verbatim payload is stored alongside, in the external source's
`data` column.

Two things worth fixing while in there. `resolveUnitId` matches a unit by name or
symbol only, so the alias lists that already exist (`tbs`, `tblsp`, `floz`) are
never consulted and Spoonacular spellings like `Tbsps` would still miss. And the
same dead metadata keys are read when adding recipe ingredients to a shopping
list, so that path loses the unit for the same reason.
