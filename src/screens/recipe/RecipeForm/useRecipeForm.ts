import { useState, useCallback, useMemo, useRef } from 'react';
import {
  type CreateRecipeInput,
  type UpdateRecipeInput,
  type RecipeIngredientInput,
  type Difficulty,
  type RecipeCategory,
  type Visibility,
  type Diet,
  type HealthGoal,
  type Intolerance,
  type RecipeFragment,
} from '#generated';

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
  visibility: Visibility | null;
  isPublished: boolean;
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
    visibility: null,
    isPublished: false,
    diets: [],
    healthGoals: [],
    intolerances: [],
    ingredients: [],
    steps: [],
    notes: '',
  });

  const initialState = useRef<RecipeFormState | null>(null);

  // Field updaters
  const updateField = useCallback(
    <K extends keyof RecipeFormState>(field: K, value: RecipeFormState[K]) => {
      setState(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Ingredient management
  const addIngredient = useCallback((ingredient?: Partial<IngredientFormState>) => {
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
  }, []);

  const updateIngredient = useCallback(
    (id: string, updates: Partial<IngredientFormState>) => {
      setState(prev => ({
        ...prev,
        ingredients: prev.ingredients.map(ing =>
          ing.id === id ? { ...ing, ...updates } : ing,
        ),
      }));
    },
    [],
  );

  const removeIngredient = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter(ing => ing.id !== id),
    }));
  }, []);

  // Step management
  const addStep = useCallback((instruction?: string) => {
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
  }, []);

  const updateStep = useCallback((id: string, instruction: string) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === id ? { ...step, instruction } : step,
      ),
    }));
  }, []);

  const removeStep = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== id),
    }));
  }, []);

  const moveStep = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newSteps = [...prev.steps];
      const [moved] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, moved);
      return {
        ...prev,
        steps: newSteps.map((step, i) => ({ ...step, sortOrder: i })),
      };
    });
  }, []);

  // Tags
  const setDiets = useCallback((diets: Diet[]) => {
    setState(prev => ({ ...prev, diets }));
  }, []);

  const setHealthGoals = useCallback((healthGoals: HealthGoal[]) => {
    setState(prev => ({ ...prev, healthGoals }));
  }, []);

  const setIntolerances = useCallback((intolerances: Intolerance[]) => {
    setState(prev => ({ ...prev, intolerances }));
  }, []);

  // Validation
  const validate = useCallback((): string | null => {
    if (!state.name.trim()) return 'Recipe name is required';
    if (state.ingredients.length === 0) return 'At least one ingredient is required';
    if (state.steps.length === 0) return 'At least one instruction step is required';
    // Check all ingredients have names
    const emptyIngredient = state.ingredients.find(i => !i.name.trim());
    if (emptyIngredient) return 'All ingredients must have a name';
    // Check all steps have text
    const emptyStep = state.steps.find(s => !s.instruction.trim());
    if (emptyStep) return 'All steps must have instructions';
    return null;
  }, [state]);

  // Build CreateRecipeInput
  const buildCreateInput = useCallback((): CreateRecipeInput => {
    const ingredients: RecipeIngredientInput[] = state.ingredients.map((ing, index) => ({
      name: ing.name.trim(),
      quantity: ing.quantity,
      unitId: ing.unitId ?? undefined,
      itemId: ing.itemId ?? undefined,
      preparation: ing.preparation?.trim() || undefined,
      section: ing.section?.trim() || undefined,
      notes: ing.notes?.trim() || undefined,
      isOptional: ing.isOptional,
      sortOrder: index,
    }));

    const instructions = state.steps.map((step, index) => ({
      step: index + 1,
      text: step.instruction.trim(),
    }));

    return {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      imageUrl: state.imageUrl.trim() || undefined,
      servings: parseInt(state.servings) || 4,
      prepTimeMinutes: parseInt(state.prepTimeMinutes) || undefined,
      cookTimeMinutes: parseInt(state.cookTimeMinutes) || undefined,
      caloriesPerServing: parseFloat(state.caloriesPerServing) || undefined,
      difficulty: state.difficulty ?? undefined,
      category: state.category ?? undefined,
      cuisine: state.cuisine.trim() || undefined,
      visibility: state.visibility ?? undefined,
      isPublished: state.isPublished,
      diets: state.diets.length > 0 ? state.diets : undefined,
      healthGoals: state.healthGoals.length > 0 ? state.healthGoals : undefined,
      intolerances: state.intolerances.length > 0 ? state.intolerances : undefined,
      notes: state.notes.trim() || undefined,
      ingredients,
      instructions,
    };
  }, [state]);

  // Build UpdateRecipeInput
  const buildUpdateInput = useCallback((): UpdateRecipeInput => {
    return {
      name: state.name.trim() || undefined,
      description: state.description.trim() || undefined,
      imageUrl: state.imageUrl.trim() || undefined,
      servings: parseInt(state.servings) || undefined,
      prepTimeMinutes: parseInt(state.prepTimeMinutes) || undefined,
      cookTimeMinutes: parseInt(state.cookTimeMinutes) || undefined,
      difficulty: state.difficulty ?? undefined,
      category: state.category ?? undefined,
      cuisine: state.cuisine.trim() || undefined,
      visibility: state.visibility ?? undefined,
      isPublished: state.isPublished,
      instructions: state.steps.map((step, index) => ({
        step: index + 1,
        text: step.instruction.trim(),
      })),
      notes: state.notes.trim() || undefined,
    };
  }, [state]);

  // Populate from existing recipe (edit mode)
  const populateFromRecipe = useCallback((recipe: RecipeFragment) => {
    const formState: RecipeFormState = {
      name: recipe.name ?? '',
      description: recipe.description ?? '',
      imageUrl: recipe.imageUrl ?? '',
      servings: String(recipe.servings ?? 4),
      prepTimeMinutes: recipe.prepTimeMinutes ? String(recipe.prepTimeMinutes) : '',
      cookTimeMinutes: recipe.cookTimeMinutes ? String(recipe.cookTimeMinutes) : '',
      caloriesPerServing: recipe.caloriesPerServing ? String(recipe.caloriesPerServing) : '',
      difficulty: recipe.difficulty ?? null,
      category: recipe.category ?? null,
      cuisine: recipe.cuisine ?? '',
      visibility: recipe.visibility ?? null,
      isPublished: recipe.isPublished ?? false,
      diets: [],
      healthGoals: [],
      intolerances: [],
      ingredients: (recipe.ingredients ?? []).map(ing => ({
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
        ? (recipe.instructions as any[]).map((step: any, i: number) => ({
            id: generateTempId(),
            instruction: typeof step === 'string' ? step : step.text ?? '',
            sortOrder: i,
          }))
        : [],
      notes: recipe.notes ?? '',
    };
    setState(formState);
    initialState.current = formState;
  }, []);

  const hasDirtyFields = useMemo(() => {
    if (!initialState.current) return state.name.trim().length > 0;
    return JSON.stringify(state) !== JSON.stringify(initialState.current);
  }, [state]);

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
    populateFromRecipe,
    hasDirtyFields,
  };
}
