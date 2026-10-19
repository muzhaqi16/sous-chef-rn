'use no memo';

import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  Cuisine,
  Difficulty,
  RecipeCategory,
  RecipeStatus,
  Diet,
  HealthGoal,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import { MAX_RECIPE_INGREDIENTS } from '#domain/recipeIngredientsPaging';
import {
  recipeFormFragment,
  recipeFormIngredient,
} from '#/test-utils/fixtures/recipeFixtures';
import { useRecipeForm } from '../useRecipeForm';

beforeEach(() => {
  jest.clearAllMocks();
});

/** The first page of a recipe over the ingredient limit. */
const OVER_THE_LIMIT = {
  totalCount: 150,
  hasNextPage: true,
  endCursor: 'cursor-100',
};

describe('useRecipeForm', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useRecipeForm());

    expect(result.current.state.name).toBe('');
    expect(result.current.state.servings).toBe('4');
    expect(result.current.state.ingredients).toEqual([]);
    expect(result.current.state.steps).toEqual([]);
    expect(result.current.state.diets).toEqual([]);
  });

  it('updateField updates a single field', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Pasta Carbonara');
    });

    expect(result.current.state.name).toBe('Pasta Carbonara');
  });

  it('addIngredient adds a new ingredient', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addIngredient({ name: 'Eggs', quantity: 3 });
    });

    expect(result.current.state.ingredients).toHaveLength(1);
    expect(result.current.state.ingredients[0]!.name).toBe('Eggs');
    expect(result.current.state.ingredients[0]!.quantity).toBe(3);
    expect(result.current.state.ingredients[0]!.sortOrder).toBe(0);
  });

  it('updateIngredient updates existing ingredient', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addIngredient({ name: 'Eggs' });
    });

    const ingredientId = result.current.state.ingredients[0]!.id;

    act(() => {
      result.current.updateIngredient(ingredientId, { name: 'Large Eggs' });
    });

    expect(result.current.state.ingredients[0]!.name).toBe('Large Eggs');
  });

  it('removeIngredient removes an ingredient', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addIngredient({ name: 'Eggs' });
      result.current.addIngredient({ name: 'Bacon' });
    });

    const firstIngredientId = result.current.state.ingredients[0]!.id;

    act(() => {
      result.current.removeIngredient(firstIngredientId);
    });

    expect(result.current.state.ingredients).toHaveLength(1);
    expect(result.current.state.ingredients[0]!.name).toBe('Bacon');
  });

  it('addStep adds a new step', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addStep('Boil water');
    });

    expect(result.current.state.steps).toHaveLength(1);
    expect(result.current.state.steps[0]!.instruction).toBe('Boil water');
  });

  it('updateStep modifies instruction', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addStep('Boil water');
    });

    const stepId = result.current.state.steps[0]!.id;

    act(() => {
      result.current.updateStep(stepId, 'Boil salted water');
    });

    expect(result.current.state.steps[0]!.instruction).toBe(
      'Boil salted water',
    );
  });

  it('removeStep removes a step', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addStep('Step 1');
      result.current.addStep('Step 2');
    });

    const firstStepId = result.current.state.steps[0]!.id;

    act(() => {
      result.current.removeStep(firstStepId);
    });

    expect(result.current.state.steps).toHaveLength(1);
  });

  // Each refusal has to reach the FIELD it is about — the screen renders the
  // name's under its input and the two lists' under their sections — so the
  // submit is driven through `handleSubmit` and the errors read back per key.
  const submit = async (result: {
    current: ReturnType<typeof useRecipeForm>;
  }) => {
    await act(async () => {
      await result.current.handleSubmit(async () => {})();
    });
  };

  it('attaches the missing-name refusal to `name`', async () => {
    const { result } = renderHook(() => useRecipeForm());

    await submit(result);
    expect(result.current.errors.name?.message).toBe('Recipe name is required');
  });

  it('attaches the empty-list refusal to `ingredients`', async () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Test Recipe');
    });

    await submit(result);
    expect(result.current.errors.ingredients?.message).toBe(
      'At least one ingredient is required',
    );
    expect(result.current.errors.name).toBeUndefined();
  });

  // A recipe holds at most 100 ingredients.
  describe('the ingredient limit', () => {
    const fill = (
      result: { current: ReturnType<typeof useRecipeForm> },
      count: number,
    ) => {
      act(() => {
        result.current.updateField('name', 'Test Recipe');
        result.current.addStep('Cook');
        for (let index = 0; index < count; index += 1) {
          result.current.addIngredient({ name: `Ingredient ${index}` });
        }
      });
    };

    it('attaches the refusal of a 101st ingredient to `ingredients`', async () => {
      const { result } = renderHook(() => useRecipeForm());
      fill(result, MAX_RECIPE_INGREDIENTS + 1);

      await submit(result);

      expect(result.current.state.ingredients).toHaveLength(101);
      expect(result.current.errors.ingredients?.message).toBe(
        'A recipe can have at most 100 ingredients',
      );
    });

    it('raises nothing for exactly 100', async () => {
      const { result } = renderHook(() => useRecipeForm());
      fill(result, MAX_RECIPE_INGREDIENTS);

      await submit(result);

      expect(result.current.state.ingredients).toHaveLength(100);
      expect(result.current.errors).toEqual({});
    });

    // An ingredient change validates the list, so the message does not wait
    // for a save, and goes once the list is back within the limit.
    it('reports the 101st ingredient as it is added, and clears on a removal', async () => {
      const { result } = renderHook(() => useRecipeForm());
      fill(result, MAX_RECIPE_INGREDIENTS);
      await waitFor(() =>
        expect(result.current.errors.ingredients).toBeUndefined(),
      );

      act(() => {
        result.current.addIngredient({ name: 'One too many' });
      });
      await waitFor(() =>
        expect(result.current.errors.ingredients?.message).toBe(
          'A recipe can have at most 100 ingredients',
        ),
      );

      const [first] = result.current.state.ingredients;
      act(() => {
        result.current.removeIngredient(first!.id);
      });
      await waitFor(() =>
        expect(result.current.errors.ingredients).toBeUndefined(),
      );
    });
  });

  it('attaches the empty-list refusal to `steps`', async () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Test Recipe');
      result.current.addIngredient({ name: 'Egg' });
    });

    await submit(result);
    expect(result.current.errors.steps?.message).toBe(
      'At least one instruction step is required',
    );
  });

  it('attaches a blank ingredient name to that ingredient, not the list', async () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Test Recipe');
      result.current.addIngredient();
      result.current.addStep('Step 1');
    });

    await submit(result);
    expect(result.current.errors.ingredients?.[0]?.name?.message).toBe(
      'All ingredients must have a name',
    );
  });

  it('raises nothing for a valid form', async () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Test Recipe');
      result.current.addIngredient({ name: 'Egg' });
      result.current.addStep('Cook egg');
    });

    await submit(result);
    expect(result.current.errors).toEqual({});
  });

  it('buildCreateInput creates proper input structure', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Test Recipe');
      result.current.updateField('servings', '6');
      result.current.addIngredient({ name: 'Flour', quantity: 2 });
      result.current.addStep('Mix ingredients');
    });

    const input = result.current.buildCreateInput();

    expect(input.name).toBe('Test Recipe');
    expect(input.metadata?.servings).toBe(6);
    expect(input.ingredients).toHaveLength(1);
    expect(input.instructions).toHaveLength(1);
    // instructions is a JSON scalar (JsonInput union); narrow via Array.isArray.
    expect(Array.isArray(input.instructions)).toBe(true);
    if (Array.isArray(input.instructions)) {
      expect(input.instructions[0].step).toBe(1);
    }
  });

  it('buildUpdateInput creates update structure', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Updated Recipe');
      result.current.addStep('New step');
    });

    const input = result.current.buildUpdateInput();

    expect(input.name).toBe('Updated Recipe');
    expect(input.instructions).toHaveLength(1);
  });

  it('buildUpdateInput carries tips, tags, and attribution', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'R');
      result.current.updateField('tips', 'Chill the dough.');
      result.current.updateField('tags', 'quick, vegan , ');
      result.current.updateField('originalAuthor', 'Grandma');
    });

    const input = result.current.buildUpdateInput();
    expect(input.tips).toBe('Chill the dough.');
    // Comma field is split, trimmed, and empties dropped.
    expect(input.tags).toEqual(['quick', 'vegan']);
    expect(input.attribution).toEqual({ originalAuthor: 'Grandma' });
  });

  it('buildUpdateInput carries nutrition and dietary edits', () => {
    // Pins: the update input carries nutrition/dietary, as the create input
    // does. Omitting them silently discards calories and diet edits made in
    // edit mode on save.
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'R');
      result.current.updateField('caloriesPerServing', '320');
      result.current.updateField('diets', [Diet.Keto]);
      result.current.updateField('healthGoals', [HealthGoal.HighProtein]);
      result.current.updateField('intolerances', [Intolerance.Dairy]);
    });

    const input = result.current.buildUpdateInput();
    expect(input.nutrition).toEqual({ caloriesPerServing: 320 });
    expect(input.dietary).toEqual({
      diets: [Diet.Keto],
      healthGoals: [HealthGoal.HighProtein],
      intolerances: [Intolerance.Dairy],
    });
  });

  it('buildUpdateInput clears emptied optional fields instead of omitting them', () => {
    // An omitted field is left unchanged by the API, so an emptied one must be
    // sent as a clear: null for a nullable column, [] for a dietary list.
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', '');
      result.current.updateField('servings', '');
      result.current.updateField('description', '  ');
      result.current.updateField('notes', '');
      result.current.updateField('tips', '');
      result.current.updateField('originalAuthor', '');
      result.current.updateField('imageUrl', '');
      result.current.updateField('cuisines', []);
      result.current.updateField('prepTimeMinutes', '');
      result.current.updateField('cookTimeMinutes', '');
      result.current.updateField('caloriesPerServing', '');
      result.current.updateField('diets', []);
      result.current.updateField('healthGoals', []);
      result.current.updateField('intolerances', []);
    });

    const input = result.current.buildUpdateInput();
    expect(input).toEqual(
      expect.objectContaining({
        description: null,
        notes: null,
        tips: null,
        attribution: { originalAuthor: null },
        media: { imageUrl: null, videoUrl: null },
        timing: { prepTimeMinutes: null, cookTimeMinutes: null },
        nutrition: { caloriesPerServing: null },
        dietary: { diets: [], healthGoals: [], intolerances: [] },
      }),
    );
    // [] clears the list; the API refuses null for it.
    expect(input.metadata?.cuisines).toEqual([]);
    // NOT NULL columns: the API refuses null, so an empty entry stays omitted.
    expect(input.name).toBeUndefined();
    expect(input.metadata?.servings).toBeUndefined();
  });

  it('buildUpdateInput sends an emptied tag field as [], which clears', () => {
    // The API replaces the whole list and refuses `tags: null`; an omitted
    // list leaves the stored tags in place.
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('tags', ' , ');
    });

    expect(result.current.buildUpdateInput().tags).toEqual([]);
  });

  it('populateFromRecipe fills form from recipe data', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.populateFromRecipe(
        recipeFormFragment({
          version: 4,
          name: 'Existing Recipe',
          servings: 2,
          diets: [Diet.Keto],
          healthGoals: [HealthGoal.HighProtein],
          intolerances: [Intolerance.Dairy],
          ingredients: [
            recipeFormIngredient({ id: 'ing-1', name: 'Salt', quantity: 1 }),
          ],
          instructions: [{ text: 'Add salt' }],
        }),
      );
    });

    expect(result.current.state.name).toBe('Existing Recipe');
    expect(result.current.state.servings).toBe('2');
    expect(result.current.state.ingredients).toHaveLength(1);
    expect(result.current.state.steps).toHaveLength(1);
    expect(result.current.state.steps[0]!.instruction).toBe('Add salt');
    // Pins: editing a recipe preserves its dietary classification. Hardcoding
    // [] on populate wipes the tags on the next save.
    expect(result.current.state.diets).toEqual([Diet.Keto]);
    expect(result.current.state.healthGoals).toEqual([HealthGoal.HighProtein]);
    expect(result.current.state.intolerances).toEqual([Intolerance.Dairy]);
    // A save sends the version it loaded, so an edit made since is refused.
    expect(result.current.buildUpdateInput().version).toBe(4);
    expect(result.current.buildUpdateInput().ingredientsUnread).toBe(false);
  });

  it('populateFromRecipe handles { number, step } instruction format', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.populateFromRecipe(
        recipeFormFragment({
          instructions: [
            { number: 1, step: 'Boil the water' },
            { number: 2, step: 'Cook the pasta' },
          ],
        }),
      );
    });

    expect(result.current.state.steps).toHaveLength(2);
    expect(result.current.state.steps[0]!.instruction).toBe('Boil the water');
    expect(result.current.state.steps[1]!.instruction).toBe('Cook the pasta');
  });

  // The API matches a replaced ingredient by name, so a renamed one keeps its
  // line as written only when the form sends it back.
  it("keeps an ingredient's line as written and its unit through a rename", () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.populateFromRecipe(
        recipeFormFragment({
          ingredients: [
            recipeFormIngredient({
              id: 'ing-1',
              name: 'all-purpose flour',
              originalText: '2 ½ cups all-purpose flour, sifted',
              unit: {
                __typename: 'Unit',
                id: 'u-cup',
                name: 'cup',
                symbol: 'cup',
              },
            }),
          ],
        }),
      );
    });
    const [loaded] = result.current.state.ingredients;
    expect(loaded?.unitLabel).toBe('cup');
    act(() => {
      result.current.updateIngredient(loaded!.id, { name: 'bread flour' });
    });

    expect(result.current.buildUpdateInput().ingredients?.[0]).toMatchObject({
      name: 'bread flour',
      originalText: '2 ½ cups all-purpose flour, sifted',
    });
  });

  // A save sends the whole form: filled from the live recipe, it would set
  // every change the pending edit holds back to the published value.
  it('populateFromRecipe reopens a pending edit from what it proposes', () => {
    const { result } = renderHook(() => useRecipeForm());

    const recipe = recipeFormFragment({
      name: 'Live Name',
      servings: 2,
      status: RecipeStatus.Published,
      tags: ['live'],
      instructions: [{ text: 'Live step' }],
      // The live recipe is over the ingredient limit, so the device holds part
      // of its list; the proposed one below is whole.
      ingredientsPage: OVER_THE_LIMIT,
      pendingRevision: {
        __typename: 'RecipeRevision',
        id: 'rev-1',
        proposed: {
          __typename: 'RecipeContent',
          name: 'Proposed Name',
          description: 'Proposed description',
          imageUrl: null,
          videoUrl: null,
          servings: 6,
          prepTimeMinutes: 15,
          cookTimeMinutes: 30,
          caloriesPerServing: null,
          difficulty: Difficulty.Medium,
          category: RecipeCategory.MainCourse,
          cuisines: [Cuisine.Italian],
          diets: [],
          healthGoals: [],
          intolerances: [],
          notes: null,
          tips: null,
          originalAuthor: null,
          tags: ['proposed'],
          instructions: [{ text: 'Proposed step' }],
          ingredients: [
            {
              __typename: 'RecipeIngredientLine',
              name: 'Olive oil',
              quantity: 2,
              item: {
                __typename: 'Item',
                id: 'item-oil',
                name: 'Olive oil',
                imageUrl: null,
              },
              unit: {
                __typename: 'Unit',
                id: 'unit-tbsp',
                name: 'tablespoon',
                symbol: 'tbsp',
              },
              isOptional: false,
              notes: null,
              preparation: null,
              sortOrder: 0,
              section: null,
            },
          ],
        },
      },
    });

    act(() => {
      result.current.populateFromRecipe(recipe);
    });

    expect(result.current.state.name).toBe('Proposed Name');
    expect(result.current.state.servings).toBe('6');
    expect(result.current.state.difficulty).toBe(Difficulty.Medium);
    expect(result.current.state.tags).toBe('proposed');
    expect(result.current.state.steps[0]!.instruction).toBe('Proposed step');
    expect(result.current.state.ingredients).toEqual([
      expect.objectContaining({
        name: 'Olive oil',
        quantity: 2,
        unitId: 'unit-tbsp',
        itemId: 'item-oil',
      }),
    ]);
    // The status is the recipe's own: a pending edit leaves it PUBLISHED.
    expect(result.current.state.status).toBe(RecipeStatus.Published);
    // The form holds the proposed list, all of it, so its save may replace.
    expect(result.current.buildUpdateInput().ingredientsUnread).toBe(false);
  });

  // A save replaces the whole list with the form's, which holds one page of a
  // recipe over the limit.
  it('populateFromRecipe marks a recipe over the ingredient limit', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.populateFromRecipe(
        recipeFormFragment({ version: 7, ingredientsPage: OVER_THE_LIMIT }),
      );
    });

    expect(result.current.buildUpdateInput()).toEqual(
      expect.objectContaining({ version: 7, ingredientsUnread: true }),
    );
  });

  it('setDiets, setHealthGoals, setIntolerances update tags', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.setDiets([Diet.Vegan]);
      result.current.setHealthGoals([HealthGoal.HighProtein]);
      result.current.setIntolerances([Intolerance.Gluten]);
    });

    expect(result.current.state.diets).toEqual([Diet.Vegan]);
    expect(result.current.state.healthGoals).toEqual([HealthGoal.HighProtein]);
    expect(result.current.state.intolerances).toEqual([Intolerance.Gluten]);
  });
});
