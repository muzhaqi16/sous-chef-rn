import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RecipeStatus,
  type CreateRecipeInput,
  type UpdateRecipeInput,
  type RecipeIngredientInput,
  type Difficulty,
  type RecipeCategory,
  type Diet,
  type HealthGoal,
  type Intolerance,
} from '#/graphql/generated/schemaTypes';
import { type RecipeForm_RecipeFragment } from './RecipeForm.generated';
import { stripPriceFromName } from '#/utils/stripPriceFromName';
import { extractNodes } from '#/utils/connectionUtils';

export interface IngredientFormState {
  id: string; // local temp id
  name: string;
  quantity: number;
  unitId?: string | null;
  itemId?: string | null;
  preparation?: string;
  section?: string;
  notes?: string;
  isOptional: boolean;
  sortOrder: number;
}

export interface StepFormState {
  id: string; // local temp id
  instruction: string;
  sortOrder: number;
}

export interface RecipeFormState {
  // Basic
  name: string;
  description: string;
  imageUrl: string;
  servings: string;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  caloriesPerServing: string;
  // Category
  difficulty: Difficulty | null;
  category: RecipeCategory | null;
  cuisine: string;
  status: RecipeStatus;
  // Tags
  diets: Diet[];
  healthGoals: HealthGoal[];
  intolerances: Intolerance[];
  // Nested
  ingredients: IngredientFormState[];
  steps: StepFormState[];
  // Meta
  notes: string;
}

let nextTempId = 1;
function generateTempId(): string {
  return `temp-${nextTempId++}`;
}

export function useRecipeForm() {
  const { t } = useTranslation();
  const [state, setState] = useState<RecipeFormState>({
    name: '',
    description: '',
    imageUrl: '',
    servings: '4',
    prepTimeMinutes: '',
    cookTimeMinutes: '',
    caloriesPerServing: '',
    difficulty: null,
    category: null,
    cuisine: '',
    status: RecipeStatus.Draft,
    diets: [],
    healthGoals: [],
    intolerances: [],
    ingredients: [],
    steps: [],
    notes: '',
  });

  const [initialState, setInitialState] = useState<RecipeFormState | null>(
    null,
  );

  // Field updaters
  const updateField = <K extends keyof RecipeFormState>(
    field: K,
    value: RecipeFormState[K],
  ) => {
    setState(prev => ({ ...prev, [field]: value }));
  };

  // Ingredient management
  const addIngredient = (ingredient?: Partial<IngredientFormState>) => {
    setState(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
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
          sortOrder: prev.ingredients.length,
          ...ingredient,
        },
      ],
    }));
  };

  const updateIngredient = (
    id: string,
    updates: Partial<IngredientFormState>,
  ) => {
    setState(prev => ({
      ...prev,
      ingredients: prev.ingredients.map(ing =>
        ing.id === id ? { ...ing, ...updates } : ing,
      ),
    }));
  };

  const removeIngredient = (id: string) => {
    setState(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter(ing => ing.id !== id),
    }));
  };

  // Step management
  const addStep = (instruction?: string) => {
    setState(prev => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          id: generateTempId(),
          instruction: instruction ?? '',
          sortOrder: prev.steps.length,
        },
      ],
    }));
  };

  const updateStep = (id: string, instruction: string) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === id ? { ...step, instruction } : step,
      ),
    }));
  };

  const removeStep = (id: string) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== id),
    }));
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newSteps = [...prev.steps];
      const [moved] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, moved);
      return {
        ...prev,
        steps: newSteps.map((step, i) => ({ ...step, sortOrder: i })),
      };
    });
  };

  // Tags
  const setDiets = (diets: Diet[]) => {
    setState(prev => ({ ...prev, diets }));
  };

  const setHealthGoals = (healthGoals: HealthGoal[]) => {
    setState(prev => ({ ...prev, healthGoals }));
  };

  const setIntolerances = (intolerances: Intolerance[]) => {
    setState(prev => ({ ...prev, intolerances }));
  };

  // Validation
  const validate = (): string | null => {
    if (!state.name.trim()) return t('recipes.nameRequired');
    if (state.ingredients.length === 0) return t('recipes.ingredientRequired');
    if (state.steps.length === 0) return t('recipes.stepRequired');
    // Check all ingredients have names
    const emptyIngredient = state.ingredients.find(i => !i.name.trim());
    if (emptyIngredient) return t('recipes.ingredientNameRequired');
    // Check all steps have text
    const emptyStep = state.steps.find(s => !s.instruction.trim());
    if (emptyStep) return t('recipes.stepInstructionsRequired');
    return null;
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
        caloriesPerServing: parseFloat(state.caloriesPerServing) || undefined,
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
      caloriesPerServing: recipe.caloriesPerServing
        ? String(recipe.caloriesPerServing)
        : '',
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
    };
    setState(formState);
    setInitialState(formState);
  };

  const hasDirtyFields = (() => {
    if (!initialState) return state.name.trim().length > 0;
    return JSON.stringify(state) !== JSON.stringify(initialState);
  })();

  return {
    state,
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
    validate,
    buildCreateInput,
    buildUpdateInput,
    buildIngredientsInput,
    populateFromRecipe,
    hasDirtyFields,
  };
}
