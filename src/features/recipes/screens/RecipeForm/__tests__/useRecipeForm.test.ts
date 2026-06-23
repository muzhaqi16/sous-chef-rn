'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import {
  Difficulty,
  RecipeCategory,
  RecipeStatus,
  Diet,
  HealthGoal,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import { useRecipeForm } from '../useRecipeForm';
import type { RecipeForm_RecipeFragment } from '../RecipeForm.generated';

beforeEach(() => {
  jest.clearAllMocks();
});

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
    expect(result.current.state.ingredients[0].name).toBe('Eggs');
    expect(result.current.state.ingredients[0].quantity).toBe(3);
    expect(result.current.state.ingredients[0].sortOrder).toBe(0);
  });

  it('updateIngredient updates existing ingredient', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addIngredient({ name: 'Eggs' });
    });

    const ingredientId = result.current.state.ingredients[0].id;

    act(() => {
      result.current.updateIngredient(ingredientId, { name: 'Large Eggs' });
    });

    expect(result.current.state.ingredients[0].name).toBe('Large Eggs');
  });

  it('removeIngredient removes an ingredient', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addIngredient({ name: 'Eggs' });
      result.current.addIngredient({ name: 'Bacon' });
    });

    const firstIngredientId = result.current.state.ingredients[0].id;

    act(() => {
      result.current.removeIngredient(firstIngredientId);
    });

    expect(result.current.state.ingredients).toHaveLength(1);
    expect(result.current.state.ingredients[0].name).toBe('Bacon');
  });

  it('addStep adds a new step', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addStep('Boil water');
    });

    expect(result.current.state.steps).toHaveLength(1);
    expect(result.current.state.steps[0].instruction).toBe('Boil water');
  });

  it('updateStep modifies instruction', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addStep('Boil water');
    });

    const stepId = result.current.state.steps[0].id;

    act(() => {
      result.current.updateStep(stepId, 'Boil salted water');
    });

    expect(result.current.state.steps[0].instruction).toBe('Boil salted water');
  });

  it('removeStep removes a step', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addStep('Step 1');
      result.current.addStep('Step 2');
    });

    const firstStepId = result.current.state.steps[0].id;

    act(() => {
      result.current.removeStep(firstStepId);
    });

    expect(result.current.state.steps).toHaveLength(1);
  });

  it('moveStep reorders steps', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.addStep('Step A');
      result.current.addStep('Step B');
      result.current.addStep('Step C');
    });

    act(() => {
      result.current.moveStep(2, 0);
    });

    expect(result.current.state.steps[0].instruction).toBe('Step C');
    expect(result.current.state.steps[0].sortOrder).toBe(0);
    expect(result.current.state.steps[1].sortOrder).toBe(1);
  });

  it('validate returns error when name is empty', () => {
    const { result } = renderHook(() => useRecipeForm());

    const error = result.current.validate();
    expect(error).toBe('Recipe name is required');
  });

  it('validate returns error when no ingredients', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Test Recipe');
    });

    expect(result.current.validate()).toBe(
      'At least one ingredient is required',
    );
  });

  it('validate returns error when no steps', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Test Recipe');
      result.current.addIngredient({ name: 'Egg' });
    });

    expect(result.current.validate()).toBe(
      'At least one instruction step is required',
    );
  });

  it('validate returns error for empty ingredient names', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Test Recipe');
      result.current.addIngredient(); // Empty ingredient
      result.current.addStep('Step 1');
    });

    expect(result.current.validate()).toBe('All ingredients must have a name');
  });

  it('validate returns null for valid form', () => {
    const { result } = renderHook(() => useRecipeForm());

    act(() => {
      result.current.updateField('name', 'Test Recipe');
      result.current.addIngredient({ name: 'Egg' });
      result.current.addStep('Cook egg');
    });

    expect(result.current.validate()).toBeNull();
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

  it('populateFromRecipe fills form from recipe data', () => {
    const { result } = renderHook(() => useRecipeForm());

    const recipe: RecipeForm_RecipeFragment = {
      __typename: 'Recipe',
      id: 'recipe-1',
      name: 'Existing Recipe',
      description: 'A recipe',
      imageUrl: 'http://img.jpg',
      servings: 2,
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      caloriesPerServing: 300,
      difficulty: Difficulty.Easy,
      category: RecipeCategory.MainCourse,
      cuisine: 'Italian',
      status: RecipeStatus.Published,
      ingredients: [
        {
          __typename: 'RecipeIngredient',
          id: 'ing-1',
          name: 'Salt',
          quantity: 1,
          image: null,
          unit: null,
          item: null,
          preparation: null,
          section: null,
          notes: null,
          isOptional: false,
          sortOrder: 0,
        },
      ],
      instructions: [{ text: 'Add salt' }],
      notes: 'A note',
    };

    act(() => {
      result.current.populateFromRecipe(recipe);
    });

    expect(result.current.state.name).toBe('Existing Recipe');
    expect(result.current.state.servings).toBe('2');
    expect(result.current.state.ingredients).toHaveLength(1);
    expect(result.current.state.steps).toHaveLength(1);
    expect(result.current.state.steps[0].instruction).toBe('Add salt');
  });

  it('populateFromRecipe handles { number, step } instruction format', () => {
    const { result } = renderHook(() => useRecipeForm());

    const recipe: RecipeForm_RecipeFragment = {
      __typename: 'Recipe',
      id: 'recipe-2',
      name: 'External Recipe',
      description: '',
      imageUrl: null,
      servings: 4,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      caloriesPerServing: null,
      difficulty: Difficulty.Easy,
      category: RecipeCategory.MainCourse,
      cuisine: null,
      status: RecipeStatus.Published,
      ingredients: [],
      instructions: [
        { number: 1, step: 'Boil the water' },
        { number: 2, step: 'Cook the pasta' },
      ],
      notes: null,
    };

    act(() => {
      result.current.populateFromRecipe(recipe);
    });

    expect(result.current.state.steps).toHaveLength(2);
    expect(result.current.state.steps[0].instruction).toBe('Boil the water');
    expect(result.current.state.steps[1].instruction).toBe('Cook the pasta');
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

  it('hasDirtyFields detects changes from initial state', () => {
    const { result } = renderHook(() => useRecipeForm());

    expect(result.current.hasDirtyFields).toBe(false);

    act(() => {
      result.current.updateField('name', 'Changed');
    });

    expect(result.current.hasDirtyFields).toBe(true);
  });
});
