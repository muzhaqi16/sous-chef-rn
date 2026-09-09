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
