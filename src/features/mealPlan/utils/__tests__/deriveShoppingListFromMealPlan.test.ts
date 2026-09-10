import {
  deriveShoppingListFromMealPlan,
  type PlannedMeal,
} from '#features/mealPlan/utils/deriveShoppingListFromMealPlan';

/**
 * The rules here are the server's, read out of
 * `MealPlanService.generateShoppingListFromMealPlan`. A derived list and a
 * server-generated one have to produce the same rows from the same plan, so
 * each case pins one of its decisions rather than this function's preferences.
 */

let next = 0;
const mintId = () => `minted-${++next}`;
beforeEach(() => {
  next = 0;
});

const meal = (
  id: string,
  servings: number | null,
  recipe: PlannedMeal['recipe'],
): PlannedMeal => ({ id, servings, recipe });

const base = {
  mealPlanId: 'plan-1',
  mealPlanName: 'Week One',
  checkPantry: false,
  pantryRows: null,
  mintId,
};

describe('deriving a shopping list from a cached meal plan', () => {
  it('scales an ingredient by planned servings over recipe servings', () => {
    const meals = [
      meal('mpi-1', 4, {
        id: 'r-1',
        servings: 2,
        ingredients: [
          {
            id: 'ri-1',
            name: 'Onion',
            quantity: 3,
            itemId: 'i-1',
            unitId: 'u-1',
          },
        ],
      }),
    ];

    const { inputs } = deriveShoppingListFromMealPlan(meals, base);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.quantity).toBe(6);
    expect(inputs[0]?.item).toEqual({ itemId: 'i-1' });
    expect(inputs[0]?.unit).toEqual({ unitId: 'u-1' });
  });

  it('takes the recipe as written when it declares no servings', () => {
    const meals = [
      meal('mpi-1', 4, {
        id: 'r-1',
        servings: 0,
        ingredients: [
          {
            id: 'ri-1',
            name: 'Onion',
            quantity: 3,
            itemId: 'i-1',
            unitId: 'u-1',
          },
        ],
      }),
    ];

    // Dividing by the declared count would be Infinity, which is not a quantity.
    expect(
      deriveShoppingListFromMealPlan(meals, base).inputs[0]?.quantity,
    ).toBe(3);
  });

  it('merges the same item in the same unit into one line', () => {
    const meals = [
      meal('mpi-1', 1, {
        id: 'r-1',
        servings: 1,
        ingredients: [
          {
            id: 'ri-1',
            name: 'Onion',
            quantity: 2,
            itemId: 'i-1',
            unitId: 'u-1',
          },
        ],
      }),
      meal('mpi-2', 1, {
        id: 'r-2',
        servings: 1,
        ingredients: [
          {
            id: 'ri-2',
            name: 'Onion',
            quantity: 5,
            itemId: 'i-1',
            unitId: 'u-1',
          },
        ],
      }),
    ];

    const { inputs } = deriveShoppingListFromMealPlan(meals, base);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.quantity).toBe(7);
    // Provenance comes from the first occurrence, as the server's does.
    expect(inputs[0]?.recipeContext?.recipeId).toBe('r-1');
    expect(inputs[0]?.recipeContext?.recipeIngredientId).toBe('ri-1');
  });

  it('keeps the same item in a different unit as its own line', () => {
    const meals = [
      meal('mpi-1', 1, {
        id: 'r-1',
        servings: 1,
        ingredients: [
          {
            id: 'ri-1',
            name: 'Milk',
            quantity: 2,
            itemId: 'i-1',
            unitId: 'ml',
          },
          { id: 'ri-2', name: 'Milk', quantity: 1, itemId: 'i-1', unitId: 'l' },
        ],
      }),
    ];

    // The server converts nothing at aggregation time; two units, two rows.
    expect(deriveShoppingListFromMealPlan(meals, base).inputs).toHaveLength(2);
  });

  it('derives the rest of the plan when one meal has no cached recipe', () => {
    const meals = [
      meal('mpi-1', 1, null),
      meal('mpi-2', 1, {
        id: 'r-2',
        servings: 1,
        ingredients: [
          {
            id: 'ri-2',
            name: 'Rice',
            quantity: 1,
            itemId: 'i-2',
            unitId: 'u-1',
          },
        ],
      }),
    ];

    const { inputs, skipped } = deriveShoppingListFromMealPlan(meals, base);

    expect(inputs).toHaveLength(1);
    expect(inputs[0]?.item).toEqual({ itemId: 'i-2' });
    expect(skipped).toEqual([{ sourceId: 'mpi-1', reason: 'no-recipe' }]);
  });

  it('reports an ingredient with no catalog item instead of adding free text', () => {
    const meals = [
      meal('mpi-1', 1, {
        id: 'r-1',
        servings: 1,
        ingredients: [
          { id: 'ri-1', name: 'A pinch of luck', quantity: 1, unitId: 'u-1' },
          {
            id: 'ri-2',
            name: 'Rice',
            quantity: 1,
            itemId: 'i-2',
            unitId: 'u-1',
          },
        ],
      }),
    ];

    const { inputs, skipped } = deriveShoppingListFromMealPlan(meals, base);

    expect(inputs).toHaveLength(1);
    expect(skipped).toEqual([
      { sourceId: 'ri-1', reason: 'ingredient-not-in-catalog' },
    ]);
  });

  it('includes an optional ingredient, as the server does', () => {
    const meals = [
      meal('mpi-1', 1, {
        id: 'r-1',
        servings: 1,
        ingredients: [
          {
            id: 'ri-1',
            name: 'Garnish',
            quantity: 1,
            itemId: 'i-1',
            unitId: 'u-1',
          },
        ],
      }),
    ];

    expect(deriveShoppingListFromMealPlan(meals, base).inputs).toHaveLength(1);
  });

  it('mints an id per line so a queued replay converges on one row', () => {
    const meals = [
      meal('mpi-1', 1, {
        id: 'r-1',
        servings: 1,
        ingredients: [
          {
            id: 'ri-1',
            name: 'Onion',
            quantity: 1,
            itemId: 'i-1',
            unitId: 'u-1',
          },
          {
            id: 'ri-2',
            name: 'Rice',
            quantity: 1,
            itemId: 'i-2',
            unitId: 'u-1',
          },
        ],
      }),
    ];

    expect(
      deriveShoppingListFromMealPlan(meals, base).inputs.map(i => i.id),
    ).toEqual(['minted-1', 'minted-2']);
  });

  it('marks every line with the plan it came from', () => {
    const meals = [
      meal('mpi-1', 1, {
        id: 'r-1',
        servings: 1,
        ingredients: [
          {
            id: 'ri-1',
            name: 'Onion',
            quantity: 1,
            itemId: 'i-1',
            unitId: 'u-1',
          },
        ],
      }),
    ];

    expect(
      deriveShoppingListFromMealPlan(meals, base).inputs[0]?.recipeContext,
    ).toEqual({
      mealPlanId: 'plan-1',
      mealPlanItemId: 'mpi-1',
      mealPlanReference: 'Week One',
      recipeId: 'r-1',
      recipeIngredientId: 'ri-1',
    });
  });
});

describe('honouring checkPantry from cached rows', () => {
  const meals = [
    meal('mpi-1', 1, {
      id: 'r-1',
      servings: 1,
      ingredients: [
        {
          id: 'ri-1',
          name: 'Onion',
          quantity: 5,
          itemId: 'i-1',
          unitId: 'u-1',
        },
      ],
    }),
  ];

  it('reduces the line by what the pantry already holds', () => {
    const { inputs } = deriveShoppingListFromMealPlan(meals, {
      ...base,
      checkPantry: true,
      pantryRows: [{ itemId: 'i-1', unitId: 'u-1', quantity: 2 }],
    });

    expect(inputs[0]?.quantity).toBe(3);
  });

  it('drops a line the pantry fully covers', () => {
    const { inputs, skipped } = deriveShoppingListFromMealPlan(meals, {
      ...base,
      checkPantry: true,
      pantryRows: [
        { itemId: 'i-1', unitId: 'u-1', quantity: 3 },
        { itemId: 'i-1', unitId: 'u-1', quantity: 4 },
      ],
    });

    expect(inputs).toHaveLength(0);
    expect(skipped).toEqual([
      { sourceId: 'ri-1', reason: 'covered-by-pantry' },
    ]);
  });

  it('ignores a pantry row in a different unit', () => {
    // The server matches the unit's TYPE and converts; no client field carries
    // a unit's type, so an exact-unit match under-deducts rather than guessing.
    const { inputs } = deriveShoppingListFromMealPlan(meals, {
      ...base,
      checkPantry: true,
      pantryRows: [{ itemId: 'i-1', unitId: 'other', quantity: 99 }],
    });

    expect(inputs[0]?.quantity).toBe(5);
  });

  it('says the pantry was not checked when no rows are cached', () => {
    const result = deriveShoppingListFromMealPlan(meals, {
      ...base,
      checkPantry: true,
      pantryRows: null,
    });

    expect(result.pantryChecked).toBe(false);
    expect(result.inputs[0]?.quantity).toBe(5);
  });

  it('is checked, not skipped, when checkPantry is off', () => {
    expect(
      deriveShoppingListFromMealPlan(meals, { ...base, checkPantry: false })
        .pantryChecked,
    ).toBe(true);
  });
});
