import { array, mixed, number, object, string, type ObjectSchema } from 'yup';
import { t } from '#/i18n';
import {
  RecipeStatus,
  type Difficulty,
  type RecipeCategory,
  type Diet,
  type HealthGoal,
  type Intolerance,
} from '#/graphql/generated/schemaTypes';
import type {
  IngredientFormState,
  RecipeFormState,
  StepFormState,
} from './formState';

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: string) => (): string => t(key);

const ingredientSchema: ObjectSchema<IngredientFormState> = object({
  id: string().defined(),
  name: string().trim().required(msg('recipes.ingredientNameRequired')),
  quantity: number().defined(),
  unitId: string().nullable().optional(),
  itemId: string().nullable().optional(),
  preparation: string().optional(),
  section: string().optional(),
  notes: string().optional(),
  isOptional: mixed<boolean>().defined(),
  sortOrder: number().defined(),
});

const stepSchema: ObjectSchema<StepFormState> = object({
  id: string().defined(),
  instruction: string()
    .trim()
    .required(msg('recipes.stepInstructionsRequired')),
  sortOrder: number().defined(),
});

export const recipeFormSchema: ObjectSchema<RecipeFormState> = object({
  name: string().trim().required(msg('recipes.nameRequired')),
  description: string().defined(),
  imageUrl: string().defined(),
  servings: string().defined(),
  prepTimeMinutes: string().defined(),
  cookTimeMinutes: string().defined(),
  caloriesPerServing: string().defined(),
  difficulty: mixed<Difficulty>().nullable().defined(),
  category: mixed<RecipeCategory>().nullable().defined(),
  cuisine: string().defined(),
  status: mixed<RecipeStatus>().oneOf(Object.values(RecipeStatus)).defined(),
  diets: array().of(mixed<Diet>().defined()).defined(),
  healthGoals: array().of(mixed<HealthGoal>().defined()).defined(),
  intolerances: array().of(mixed<Intolerance>().defined()).defined(),
  ingredients: array()
    .of(ingredientSchema)
    .min(1, msg('recipes.ingredientRequired'))
    .defined(),
  steps: array().of(stepSchema).min(1, msg('recipes.stepRequired')).defined(),
  notes: string().defined(),
  tips: string().defined(),
  originalAuthor: string().defined(),
  tags: string().defined(),
});

export const recipeFormDefaults = (): RecipeFormState => ({
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
  tips: '',
  originalAuthor: '',
  tags: '',
});
