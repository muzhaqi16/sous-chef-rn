import {
  Diet,
  Difficulty,
  HealthGoal,
  Intolerance,
  RecipeCategory,
  RecipeStatus,
} from '#/graphql/generated/schemaTypes';
import { forkRecipe, type ForkableRecipe } from '../forkRecipe';

/**
 * What the device SHOWS while a fork is queued. The server still performs the
 * fork, so this shape is judged against `RecipeService.forkRecipe`'s copy only
 * where a create input can express it.
 */

const source: ForkableRecipe = {
  id: 'recipe-1',
  name: 'Lasagna',
  description: 'Layered',
  imageUrl: 'https://example.test/lasagna.jpg',
  servings: 6,
  prepTimeMinutes: 20,
  cookTimeMinutes: 45,
  caloriesPerServing: 520,
  difficulty: Difficulty.Medium,
  category: RecipeCategory.Dinner,
  cuisine: 'Italian',
  diets: [Diet.Vegetarian],
  healthGoals: [HealthGoal.HighProtein],
  intolerances: [Intolerance.Peanut],
  notes: 'Rest before slicing',
  tips: 'Use fresh sheets',
  originalAuthor: 'Nonna',
  tags: ['comfort'],
  instructions: [{ step: 1, text: 'Layer' }],
  ingredients: [
    {
      id: 'ri-1',
      name: 'Tomatoes',
      quantity: 800,
      isOptional: false,
      notes: null,
      preparation: 'chopped',
      section: 'Sauce',
      sortOrder: 0,
      image: null,
      item: { id: 'item-1' },
      unit: { id: 'unit-1' },
    },
  ],
};

describe('forkRecipe', () => {
  it('starts the copy as the author own draft', () => {
    expect(forkRecipe(source, { name: 'Lasagna (My Version)' })).toMatchObject({
      name: 'Lasagna (My Version)',
      status: RecipeStatus.Draft,
    });
  });

  it('carries the recipe fields a create input can express', () => {
    const input = forkRecipe(source, { name: 'Copy' });

    expect(input).toMatchObject({
      description: 'Layered',
      notes: 'Rest before slicing',
      tips: 'Use fresh sheets',
      tags: ['comfort'],
      metadata: {
        category: RecipeCategory.Dinner,
        cuisine: 'Italian',
        difficulty: Difficulty.Medium,
        servings: 6,
      },
      timing: { prepTimeMinutes: 20, cookTimeMinutes: 45 },
      dietary: {
        diets: [Diet.Vegetarian],
        healthGoals: [HealthGoal.HighProtein],
        intolerances: [Intolerance.Peanut],
      },
      nutrition: { caloriesPerServing: 520 },
      media: { imageUrl: 'https://example.test/lasagna.jpg' },
      attribution: { originalAuthor: 'Nonna' },
    });
  });

  it('carries each ingredient with its catalog item and unit', () => {
    const { ingredients } = forkRecipe(source, { name: 'Copy' });

    expect(ingredients).toEqual([
      {
        name: 'Tomatoes',
        quantity: 800,
        itemId: 'item-1',
        unitId: 'unit-1',
        isOptional: false,
        preparation: 'chopped',
        section: 'Sauce',
        sortOrder: 0,
      },
    ]);
  });

  it('keeps a free-text ingredient that names no catalog item', () => {
    const { ingredients } = forkRecipe(
      {
        ...source,
        ingredients: [{ id: 'ri-2', name: 'A pinch of salt', quantity: null }],
      },
      { name: 'Copy' },
    );

    expect(ingredients).toEqual([{ name: 'A pinch of salt', quantity: 0 }]);
  });

  it('omits a field the source does not carry rather than sending null', () => {
    const input = forkRecipe(
      {
        id: 'recipe-2',
        name: 'Bare',
        instructions: null,
        ingredients: [],
      },
      { name: 'Copy' },
    );

    expect(input).not.toHaveProperty('description');
    expect(input).not.toHaveProperty('media');
    expect(input).not.toHaveProperty('attribution');
    expect(input).not.toHaveProperty('nutrition');
    expect(input.instructions).toEqual([]);
    expect(input.ingredients).toEqual([]);
  });

  it('leaves the dietary arrays present but empty, so the copy declares none', () => {
    const { dietary } = forkRecipe(
      { id: 'r', name: 'Bare', instructions: [], ingredients: [] },
      { name: 'Copy' },
    );

    expect(dietary).toEqual({ diets: [], healthGoals: [], intolerances: [] });
  });
});
