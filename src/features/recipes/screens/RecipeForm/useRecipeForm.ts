import { useForm, useWatch, type PathValue } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import type {
  CreateRecipeInput,
  RecipeAttributionInput,
  RecipeIngredientInput,
  Diet,
  HealthGoal,
  Intolerance,
} from '#/graphql/generated/schemaTypes';
import type { UseRecipeFormWrites_RecipeFragment } from '#features/recipes/hooks/useRecipeFormWrites.generated';
import type { RecipeCaptureQuery } from '#features/recipes/hooks/useRecipeCapture.generated';
import type { RecipeUpdateFields } from '#features/recipes/hooks/useRecipeFormWrites';
import type {
  IngredientFormState,
  StepFormState,
  RecipeFormState,
} from './formState';
import {
  recipeFormSchema,
  recipeFormDefaults,
  parseCommaTags,
} from './recipeFormConfig';
import { stripPriceFromName } from '#features/recipes/utils/stripPriceFromName';
import { toPastedIngredient } from '#features/recipes/utils/pastedIngredients';
import { extractNodes } from '#/utils/connectionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { formatNumberForInput } from '#/utils/formatters/number';
import { firstNonBlank } from '#/utils/firstNonBlank';

let nextTempId = 1;
function generateTempId(): string {
  return `temp-${nextTempId++}`;
}

/**
 * A stored step is a string, `{ text }` or `{ step }` (untyped JSON). A `text`
 * that is present wins; a non-scalar one has no readable instruction.
 */
function stepInstruction(step: unknown): string {
  if (typeof step === 'string') return step;
  if (!step || typeof step !== 'object') return '';
  const text = 'text' in step ? step.text : null;
  if (text == null) {
    return 'step' in step && typeof step.step === 'string' ? step.step : '';
  }
  if (typeof text === 'string') return text;
  return typeof text === 'number' || typeof text === 'boolean'
    ? String(text)
    : '';
}

/** The unit as a row shows it. Module scope: an optional chain inside `??`
 * stops the compiler lowering the hook. */
const unitLabelOf = (
  unit: { symbol: string; name: string } | null | undefined,
): string => firstNonBlank(unit?.symbol, unit?.name) ?? '';

/** Who wrote the recipe and where a capture read it; undefined when neither is known. */
function attributionOf(
  state: RecipeFormState,
): RecipeAttributionInput | undefined {
  const originalAuthor = state.originalAuthor.trim() || undefined;
  const source = state.capturedFrom?.source ?? undefined;
  const sourceUrl = state.capturedFrom?.sourceUrl ?? undefined;
  return originalAuthor || source || sourceUrl
    ? { originalAuthor, source, sourceUrl }
    : undefined;
}

type CaptureDraft = NonNullable<
  NonNullable<RecipeCaptureQuery['recipeCapture']>['draft']
>;

const minutesText = (minutes: number | null) =>
  minutes ? String(minutes) : '';

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

  /** Rows read from pasted lines, after the ones the form holds. */
  const appendIngredients = (
    rows: readonly Omit<IngredientFormState, 'id' | 'sortOrder'>[],
  ) => {
    const current = getValues('ingredients');
    setIngredients([
      ...current,
      ...rows.map((row, index) => ({
        ...row,
        id: generateTempId(),
        sortOrder: current.length + index,
      })),
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

  // A loaded ingredient name may carry a legacy " $X.XX" token, and the API
  // stores names verbatim, so it is stripped here rather than re-persisted.
  const buildIngredientsInput = (): RecipeIngredientInput[] => {
    return state.ingredients.map((ing, index) => ({
      name: stripPriceFromName(ing.name),
      quantity: ing.quantity,
      ...(ing.originalText && { originalText: ing.originalText }),
      unitId: ing.unitId ?? undefined,
      itemId: ing.itemId ?? undefined,
      preparation: firstNonBlank(ing.preparation)?.trim(),
      section: firstNonBlank(ing.section)?.trim(),
      notes: firstNonBlank(ing.notes)?.trim(),
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
      attribution: attributionOf(state),
      ingredients,
      instructions,
      media: {
        imageUrl: state.imageUrl.trim() || undefined,
        videoUrl: state.videoUrl.trim() || undefined,
      },
      metadata: {
        servings: parseInt(state.servings) || 4,
        difficulty: state.difficulty ?? undefined,
        category: state.category ?? undefined,
        cuisines: state.cuisines.length > 0 ? state.cuisines : undefined,
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

  // Without `id`, which the caller adds. An omitted field is left unchanged, so
  // an emptied one is sent as null or []; the API refuses null for `name` and
  // `servings` (NOT NULL), so those stay omitted when blank.
  const buildUpdateInput = (): RecipeUpdateFields => {
    return {
      version: state.version,
      ingredientsUnread: state.ingredientsUnread,
      ingredients: buildIngredientsInput(),
      name: state.name.trim() || undefined,
      description: state.description.trim() || null,
      status: state.status,
      notes: state.notes.trim() || null,
      tips: state.tips.trim() || null,
      tags: parseCommaTags(state.tags),
      attribution: { originalAuthor: state.originalAuthor.trim() || null },
      instructions: state.steps.map((step, index) => ({
        step: index + 1,
        text: step.instruction.trim(),
      })),
      media: {
        imageUrl: state.imageUrl.trim() || null,
        videoUrl: state.videoUrl.trim() || null,
      },
      metadata: {
        servings: parseInt(state.servings) || undefined,
        difficulty: state.difficulty ?? undefined,
        category: state.category ?? undefined,
        cuisines: state.cuisines,
      },
      timing: {
        prepTimeMinutes: parseInt(state.prepTimeMinutes) || null,
        cookTimeMinutes: parseInt(state.cookTimeMinutes) || null,
      },
      nutrition: {
        caloriesPerServing: parseDecimalInput(state.caloriesPerServing) || null,
      },
      dietary: {
        diets: state.diets,
        healthGoals: state.healthGoals,
        intolerances: state.intolerances,
      },
    };
  };

  // Populate from existing recipe (edit mode). A pending edit reopens from
  // what it proposes: a save sends the whole form, so live values would set
  // every pending change back.
  const populateFromRecipe = (recipe: UseRecipeFormWrites_RecipeFragment) => {
    const proposed = recipe.pendingRevision?.proposed;
    const content = proposed ?? recipe;
    const ingredients = proposed
      ? proposed.ingredients
      : extractNodes(recipe.ingredientsConnection);
    const formState: RecipeFormState = {
      name: content.name,
      description: content.description ?? '',
      imageUrl: content.imageUrl ?? '',
      videoUrl: content.videoUrl ?? '',
      servings: String(content.servings),
      prepTimeMinutes: content.prepTimeMinutes
        ? String(content.prepTimeMinutes)
        : '',
      cookTimeMinutes: content.cookTimeMinutes
        ? String(content.cookTimeMinutes)
        : '',
      caloriesPerServing: formatNumberForInput(content.caloriesPerServing),
      difficulty: content.difficulty,
      category: content.category,
      cuisines: [...content.cuisines],
      status: recipe.status,
      diets: content.diets,
      healthGoals: content.healthGoals,
      intolerances: content.intolerances,
      ingredients: ingredients.map(ing => ({
        id: generateTempId(),
        name: ing.name,
        quantity: ing.quantity,
        unitId: ing.unit?.id ?? null,
        unitLabel: unitLabelOf(ing.unit),
        // A proposed revision's lines carry no line as written.
        originalText: 'originalText' in ing ? ing.originalText : null,
        itemId: ing.item?.id ?? null,
        preparation: ing.preparation ?? '',
        section: ing.section ?? '',
        notes: ing.notes ?? '',
        isOptional: ing.isOptional,
        sortOrder: ing.sortOrder,
      })),
      steps: Array.isArray(content.instructions)
        ? content.instructions.map((step: unknown, i: number) => ({
            id: generateTempId(),
            instruction: stepInstruction(step),
            sortOrder: i,
          }))
        : [],
      notes: content.notes ?? '',
      tips: content.tips ?? '',
      originalAuthor: content.originalAuthor ?? '',
      capturedFrom: null,
      tags: content.tags.join(', '),
      version: recipe.version,
      // A proposed edit carries its whole list; the live one is one page, and
      // `hasNextPage` marks a recipe over the ingredient limit.
      ingredientsUnread:
        !proposed && recipe.ingredientsConnection.pageInfo.hasNextPage,
    };
    // `reset` re-baselines `isDirty`, so loading a recipe does not read as an
    // edit — which is what the hand-rolled initial-state snapshot was for.
    reset(formState);
  };

  /**
   * A new recipe filled with what a capture read, and the link this device sent
   * it. Nothing is saved until the user saves; a section the capture found
   * nothing for is marked as needed.
   */
  const populateFromCapture = (
    draft: CaptureDraft,
    sourceUrl: string | null,
  ) => {
    const defaults = recipeFormDefaults();
    reset({
      ...defaults,
      name: draft.name ?? '',
      description: draft.description ?? '',
      imageUrl: draft.imageUrl ?? '',
      servings: draft.servings ? String(draft.servings) : defaults.servings,
      prepTimeMinutes: minutesText(draft.prepTimeMinutes),
      cookTimeMinutes: minutesText(draft.cookTimeMinutes),
      originalAuthor: draft.author ?? '',
      capturedFrom: { source: draft.sourceName, sourceUrl },
      // A line is linked only where the server was confident; the rest keep
      // their line as written for the user to match.
      ingredients: draft.lines.map((line, index) => ({
        ...toPastedIngredient(line),
        id: generateTempId(),
        sortOrder: index,
      })),
      steps: draft.steps.map((step, index) => ({
        id: generateTempId(),
        instruction: step.text,
        sortOrder: index,
      })),
    });
    if (draft.lines.length === 0) {
      void form.trigger('ingredients');
    }
    if (draft.steps.length === 0) {
      void form.trigger('steps');
    }
  };

  return {
    state,
    errors: form.formState.errors,
    isDirty: form.formState.isDirty,
    handleSubmit: form.handleSubmit,
    setError: form.setError,
    updateField,
    addIngredient,
    appendIngredients,
    updateIngredient,
    removeIngredient,
    addStep,
    updateStep,
    removeStep,
    setDiets,
    setHealthGoals,
    setIntolerances,
    buildCreateInput,
    buildUpdateInput,
    populateFromRecipe,
    populateFromCapture,
  };
}
