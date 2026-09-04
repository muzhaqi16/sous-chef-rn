import { useForm, useWatch, type PathValue } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  RecipeStatus,
  type CreateRecipeInput,
  type UpdateRecipeInput,
  type RecipeIngredientInput,
  type Diet,
  type HealthGoal,
  type Intolerance,
} from '#/graphql/generated/schemaTypes';
import { type RecipeForm_RecipeFragment } from './RecipeForm.generated';
import type {
  IngredientFormState,
  StepFormState,
  RecipeFormState,
} from './formState';
import { recipeFormSchema, recipeFormDefaults } from './recipeFormConfig';
import { stripPriceFromName } from '#features/recipes/utils/stripPriceFromName';
import { extractNodes } from '#/utils/connectionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { formatNumberForInput } from '#/utils/formatters/number';

let nextTempId = 1;
function generateTempId(): string {
  return `temp-${nextTempId++}`;
}

/** Split a comma-separated tag field into a clean list (undefined when empty). */
function parseCommaTags(raw: string): string[] | undefined {
  const tags = raw
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

export function useRecipeForm() {
  const form = useForm<RecipeFormState>({
    resolver: yupResolver(recipeFormSchema),
    defaultValues: recipeFormDefaults(),
    mode: 'onSubmit',
  });
  const { control, setValue, getValues, reset } = form;

  // The children render plain inputs against a value object rather than one
  // `Controller` each, so the whole form is watched. `useWatch`, never
  // `watch()` — the React Compiler cannot memoize the function that returns.
  const state = useWatch({ control }) as RecipeFormState;

  // Field updaters
  // The children name a top-level field; react-hook-form's `PathValue` cannot
  // reduce against an unresolved generic, so the bridge carries one cast.
  const updateField = <K extends keyof RecipeFormState>(
    field: K,
    value: RecipeFormState[K],
  ) => {
    setValue(field, value as PathValue<RecipeFormState, K>, {
      shouldDirty: true,
    });
  };

  const setIngredients = (next: IngredientFormState[]) => {
    setValue('ingredients', next, { shouldDirty: true, shouldValidate: true });
  };

  const setSteps = (next: StepFormState[]) => {
    setValue('steps', next, { shouldDirty: true, shouldValidate: true });
  };

  // Ingredient management
  const addIngredient = (ingredient?: Partial<IngredientFormState>) => {
    const current = getValues('ingredients');
    setIngredients([
      ...current,
      {
        id: generateTempId(),
        name: '',
        quantity: 1,
        unitId: null,
        itemId: null,
        preparation: '',
        section: '',
        notes: '',
        isOptional: false,
        sortOrder: current.length,
        ...ingredient,
      },
    ]);
  };

  const updateIngredient = (
    id: string,
    updates: Partial<IngredientFormState>,
  ) => {
    setIngredients(
      getValues('ingredients').map(ing =>
        ing.id === id ? { ...ing, ...updates } : ing,
      ),
    );
  };

  const removeIngredient = (id: string) => {
    setIngredients(getValues('ingredients').filter(ing => ing.id !== id));
  };

  // Step management
  const addStep = (instruction?: string) => {
    const current = getValues('steps');
    setSteps([
      ...current,
      {
        id: generateTempId(),
        instruction: instruction ?? '',
        sortOrder: current.length,
      },
    ]);
  };

  const updateStep = (id: string, instruction: string) => {
    setSteps(
      getValues('steps').map(step =>
        step.id === id ? { ...step, instruction } : step,
      ),
    );
  };

  const removeStep = (id: string) => {
    setSteps(getValues('steps').filter(step => step.id !== id));
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    const newSteps = [...getValues('steps')];
    const [moved] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, moved);
    setSteps(newSteps.map((step, i) => ({ ...step, sortOrder: i })));
  };

  // Tags
  const setDiets = (diets: Diet[]) => {
    setValue('diets', diets, { shouldDirty: true });
  };

  const setHealthGoals = (healthGoals: HealthGoal[]) => {
    setValue('healthGoals', healthGoals, { shouldDirty: true });
  };

  const setIntolerances = (intolerances: Intolerance[]) => {
    setValue('intolerances', intolerances, { shouldDirty: true });
  };

  // Build ingredient input array (shared by create and update-ingredients).
  // Names are sanitized at the API boundary: a backend ingredient name loaded
  // into the form may carry a legacy " $X.XX" token, and the API stores names
  // verbatim — strip it so we never re-persist a price baked into the name.
  const buildIngredientsInput = (): RecipeIngredientInput[] => {
    return state.ingredients.map((ing, index) => ({
      name: stripPriceFromName(ing.name),
      quantity: ing.quantity,
      unitId: ing.unitId ?? undefined,
      itemId: ing.itemId ?? undefined,
      preparation: ing.preparation?.trim() || undefined,
      section: ing.section?.trim() || undefined,
      notes: ing.notes?.trim() || undefined,
      isOptional: ing.isOptional,
      sortOrder: index,
    }));
  };

  // Build CreateRecipeInput
  const buildCreateInput = (): CreateRecipeInput => {
    const ingredients = buildIngredientsInput();

    const instructions = state.steps.map((step, index) => ({
      step: index + 1,
      text: step.instruction.trim(),
    }));

    return {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      status: state.status,
      notes: state.notes.trim() || undefined,
      tips: state.tips.trim() || undefined,
      tags: parseCommaTags(state.tags),
      attribution: state.originalAuthor.trim()
        ? { originalAuthor: state.originalAuthor.trim() }
        : undefined,
      ingredients,
      instructions,
      media: {
        imageUrl: state.imageUrl.trim() || undefined,
      },
      metadata: {
        servings: parseInt(state.servings) || 4,
        difficulty: state.difficulty ?? undefined,
        category: state.category ?? undefined,
        cuisine: state.cuisine.trim() || undefined,
      },
      timing: {
        prepTimeMinutes: parseInt(state.prepTimeMinutes) || undefined,
        cookTimeMinutes: parseInt(state.cookTimeMinutes) || undefined,
      },
      nutrition: {
        caloriesPerServing:
          parseDecimalInput(state.caloriesPerServing) || undefined,
      },
      dietary: {
        diets: state.diets.length > 0 ? state.diets : undefined,
        healthGoals:
          state.healthGoals.length > 0 ? state.healthGoals : undefined,
        intolerances:
          state.intolerances.length > 0 ? state.intolerances : undefined,
      },
    };
  };

  // Build UpdateRecipeInput (without id — caller adds it)
  const buildUpdateInput = (): Omit<UpdateRecipeInput, 'id'> => {
    return {
      name: state.name.trim() || undefined,
      description: state.description.trim() || undefined,
      status: state.status,
      notes: state.notes.trim() || undefined,
      tips: state.tips.trim() || undefined,
      tags: parseCommaTags(state.tags),
      attribution: state.originalAuthor.trim()
        ? { originalAuthor: state.originalAuthor.trim() }
        : undefined,
      instructions: state.steps.map((step, index) => ({
        step: index + 1,
        text: step.instruction.trim(),
      })),
      media: {
        imageUrl: state.imageUrl.trim() || undefined,
      },
      metadata: {
        servings: parseInt(state.servings) || undefined,
        difficulty: state.difficulty ?? undefined,
        category: state.category ?? undefined,
        cuisine: state.cuisine.trim() || undefined,
      },
      timing: {
        prepTimeMinutes: parseInt(state.prepTimeMinutes) || undefined,
        cookTimeMinutes: parseInt(state.cookTimeMinutes) || undefined,
      },
      nutrition: {
        caloriesPerServing:
          parseDecimalInput(state.caloriesPerServing) || undefined,
      },
      dietary: {
        diets: state.diets.length > 0 ? state.diets : undefined,
        healthGoals:
          state.healthGoals.length > 0 ? state.healthGoals : undefined,
        intolerances:
          state.intolerances.length > 0 ? state.intolerances : undefined,
      },
    };
  };

  // Populate from existing recipe (edit mode)
  const populateFromRecipe = (recipe: RecipeForm_RecipeFragment) => {
    const formState: RecipeFormState = {
      name: recipe.name ?? '',
      description: recipe.description ?? '',
      imageUrl: recipe.imageUrl ?? '',
      servings: String(recipe.servings ?? 4),
      prepTimeMinutes: recipe.prepTimeMinutes
        ? String(recipe.prepTimeMinutes)
        : '',
      cookTimeMinutes: recipe.cookTimeMinutes
        ? String(recipe.cookTimeMinutes)
        : '',
      caloriesPerServing: formatNumberForInput(recipe.caloriesPerServing),
      difficulty: recipe.difficulty ?? null,
      category: recipe.category ?? null,
      cuisine: recipe.cuisine ?? '',
      status: recipe.status ?? RecipeStatus.Draft,
      diets: recipe.diets ?? [],
      healthGoals: recipe.healthGoals ?? [],
      intolerances: recipe.intolerances ?? [],
      ingredients: extractNodes(recipe.ingredientsConnection).map(ing => ({
        id: generateTempId(),
        name: ing.name,
        quantity: ing.quantity ?? 1,
        unitId: ing.unit?.id ?? null,
        itemId: ing.item?.id ?? null,
        preparation: ing.preparation ?? '',
        section: ing.section ?? '',
        notes: ing.notes ?? '',
        isOptional: ing.isOptional ?? false,
        sortOrder: ing.sortOrder ?? 0,
      })),
      steps: Array.isArray(recipe.instructions)
        ? (recipe.instructions as unknown[]).map(
            (step: unknown, i: number) => ({
              id: generateTempId(),
              instruction:
                typeof step === 'string'
                  ? step
                  : step && typeof step === 'object'
                  ? String(
                      ('text' in step
                        ? (step as { text: unknown }).text
                        : null) ??
                        ('step' in step &&
                        typeof (step as { step: unknown }).step === 'string'
                          ? (step as { step: string }).step
                          : null) ??
                        '',
                    )
                  : '',
              sortOrder: i,
            }),
          )
        : [],
      notes: recipe.notes ?? '',
      tips: recipe.tips ?? '',
      originalAuthor: recipe.originalAuthor ?? '',
      tags: (recipe.tags ?? []).join(', '),
    };
    // `reset` re-baselines `isDirty`, so loading a recipe does not read as an
    // edit — which is what the hand-rolled initial-state snapshot was for.
    reset(formState);
  };

  return {
    state,
    errors: form.formState.errors,
    handleSubmit: form.handleSubmit,
    updateField,
    addIngredient,
    updateIngredient,
    removeIngredient,
    addStep,
    updateStep,
    removeStep,
    moveStep,
    setDiets,
    setHealthGoals,
    setIntolerances,
    buildCreateInput,
    buildUpdateInput,
    buildIngredientsInput,
    populateFromRecipe,
  };
}
