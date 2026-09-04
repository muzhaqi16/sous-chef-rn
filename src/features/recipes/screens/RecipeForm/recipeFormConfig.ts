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
const msgWith = (key: string, options: Record<string, unknown>) => (): string =>
  t(key, options);

/** The API's JSON-scalar bounds. */
const JSON_MAX_ITEMS = 1000;
const JSON_MAX_BYTES = 64 * 1024;

/**
 * UTF-8 BYTES, not UTF-16 code units: `String.length` under-counts every
 * non-ASCII character, so measuring with it would pass exactly the accented and
 * non-Latin recipes the server refuses. Counted from code points so the result
 * does not depend on `TextEncoder` being present in the JS engine.
 */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const point = char.codePointAt(0) ?? 0;
    if (point < 0x80) bytes += 1;
    else if (point < 0x800) bytes += 2;
    else if (point < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

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
  // The API accepts http/https only, and refuses anything else as a field-level
  // error on a form the user has already left. Blank stays valid — the field is
  // optional and an empty string is sent as undefined.
  imageUrl: string()
    .defined()
    .test(
      'http-scheme',
      msg('errors.field.imageUrl'),
      value => !value || /^https?:\/\//i.test(value),
    ),
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
  // The API bounds every JSON-scalar input at 64 KiB serialized, 8 levels deep
  // and 1,000 items at any depth, and `instructions` is the one this app sends.
  // Depth is fixed by the shape below; the two the user can move are checked
  // here rather than discovered as a field error after a long save.
  steps: array()
    .of(stepSchema)
    .min(1, msg('recipes.stepRequired'))
    .max(
      JSON_MAX_ITEMS,
      msgWith('recipes.stepsTooMany', { count: JSON_MAX_ITEMS }),
    )
    .test('json-size', msg('recipes.stepsTooLarge'), steps =>
      steps ? utf8ByteLength(JSON.stringify(steps)) <= JSON_MAX_BYTES : true,
    )
    .defined(),
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
