import { useState } from 'react';
import {
  type CreateRecipeInput,
  type UpdateRecipeInput,
  type RecipeIngredientInput,
  type Difficulty,
  type RecipeCategory,
  type Diet,
  type HealthGoal,
  type Intolerance,
  type RecipeFragment,
  RecipeStatus } from '#generated';

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
    notes: '' });

  const [initialState, setInitialState] = useState<RecipeFormState | null>(null);

  // Field updaters
  const updateField = <K extends keyof RecipeFormState>(field: K, value: RecipeFormState[K]) => {
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
          ...ingredient },
      ] }));
  };

  const updateIngredient = (id: string, updates: Partial<IngredientFormState>) => {
      setState(prev => ({
        ...prev,
        ingredients: prev.ingredients.map(ing =>
          ing.id === id ? { ...ing, ...updates } : ing,
        ) }));
    };

  const removeIngredient = (id: string) => {
    setState(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter(ing => ing.id !== id) }));
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
          sortOrder: prev.steps.length },
      ] }));
  };

  const updateStep = (id: string, instruction: string) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === id ? { ...step, instruction } : step,
      ) }));
  };

  const removeStep = (id: string) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.filter(step => step.id !== id) }));
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newSteps = [...prev.steps];
      const [moved] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, moved);
      return {
        ...prev,
        steps: newSteps.map((step, i) => ({ ...step, sortOrder: i })) };
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
  };

  // Build ingredient input array (shared by create and update-ingredients)
  const buildIngredientsInput = (): RecipeIngredientInput[] => {
    return state.ingredients.map((ing, index) => ({
      name: ing.name.trim(),
      quantity: ing.quantity,
      unitId: ing.unitId ?? undefined,
      itemId: ing.itemId ?? undefined,
      preparation: ing.preparation?.trim() || undefined,
      section: ing.section?.trim() || undefined,
      notes: ing.notes?.trim() || undefined,
      isOptional: ing.isOptional,
      sortOrder: index }));
  };

  // Build CreateRecipeInput
  const buildCreateInput = (): CreateRecipeInput => {
    const ingredients = buildIngredientsInput();

    const instructions = state.steps.map((step, index) => ({
      step: index + 1,
      text: step.instruction.trim() }));

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
      status: state.status,
      diets: state.diets.length > 0 ? state.diets : undefined,
      healthGoals: state.healthGoals.length > 0 ? state.healthGoals : undefined,
      intolerances: state.intolerances.length > 0 ? state.intolerances : undefined,
      notes: state.notes.trim() || undefined,
      ingredients,
      instructions };
  };

  // Build UpdateRecipeInput
  const buildUpdateInput = (): UpdateRecipeInput => {
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
      status: state.status,
      instructions: state.steps.map((step, index) => ({
        step: index + 1,
        text: step.instruction.trim() })),
      notes: state.notes.trim() || undefined };
  };

  // Populate from existing recipe (edit mode)
  const populateFromRecipe = (recipe: RecipeFragment) => {
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
      status: recipe.status ?? RecipeStatus.Draft,
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
        sortOrder: ing.sortOrder ?? 0 })),
      steps: Array.isArray(recipe.instructions)
        ? (recipe.instructions as unknown[]).map((step: unknown, i: number) => ({
            id: generateTempId(),
            instruction: typeof step === 'string' ? step : (step && typeof step === 'object' && 'text' in step ? String((step as { text: unknown }).text) : ''),
            sortOrder: i }))
        : [],
      notes: recipe.notes ?? '' };
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
    hasDirtyFields };
}
