import {
  Difficulty,
  RecipeCategory,
  RecipeStatus,
} from '#/graphql/generated/schemaTypes';
import type { RecipeForm_RecipeFragment } from '#features/recipes/screens/RecipeForm/RecipeForm.generated';
import { typedConnectionOf } from './connectionOf';

type RecipeFormIngredient =
  RecipeForm_RecipeFragment['ingredientsConnection']['edges'][number]['node'];

/** An ingredient line as the editor selects it: unlinked and unitless unless stated. */
export const recipeFormIngredient = (
  overrides: Pick<RecipeFormIngredient, 'id' | 'name'> &
    Partial<RecipeFormIngredient>,
): RecipeFormIngredient => ({
  __typename: 'RecipeIngredient',
  quantity: null,
  originalText: null,
  image: null,
  unit: null,
  item: null,
  preparation: null,
  section: null,
  notes: null,
  isOptional: false,
  sortOrder: 0,
  ...overrides,
});

interface RecipeFormFixture
  extends Partial<Omit<RecipeForm_RecipeFragment, 'ingredientsConnection'>> {
  ingredients?: RecipeFormIngredient[];
  /** The page the device holds; a recipe over the ingredient limit has a next one. */
  ingredientsPage?: {
    totalCount: number;
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

/**
 * `RecipeForm_recipe` complete, for the editor's own reads and for a
 * `seedCache` held to that fragment: a draft with no optional field set and its
 * whole ingredient list on the device, unless stated.
 */
export const recipeFormFragment = ({
  ingredients = [],
  ingredientsPage,
  ...overrides
}: RecipeFormFixture = {}): RecipeForm_RecipeFragment => ({
  __typename: 'Recipe',
  id: 'recipe-1',
  version: 1,
  name: 'Recipe',
  description: null,
  imageUrl: null,
  videoUrl: null,
  servings: 4,
  prepTimeMinutes: null,
  cookTimeMinutes: null,
  caloriesPerServing: null,
  difficulty: Difficulty.Easy,
  category: RecipeCategory.MainCourse,
  cuisines: [],
  status: RecipeStatus.Draft,
  diets: [],
  healthGoals: [],
  intolerances: [],
  notes: null,
  tips: null,
  originalAuthor: null,
  tags: [],
  instructions: [],
  ingredientsConnection: typedConnectionOf(
    'RecipeIngredient',
    ingredients,
    ingredientsPage,
  ),
  pendingRevision: null,
  ...overrides,
});
