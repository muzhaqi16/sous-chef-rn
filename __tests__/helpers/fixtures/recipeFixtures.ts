import {
  Difficulty,
  RecipeCategory,
  RecipeStatus,
} from '#/graphql/generated/schemaTypes';
import type { UseRecipeFormWrites_RecipeFragment } from '#features/recipes/hooks/useRecipeFormWrites.generated';
import { typedConnectionOf } from './connectionOf';
import type { MockDataFor } from '../apolloMockProvider';
import type { GetRecipeDocument } from '#features/recipes/graphql/recipe.generated';

type RecipeFormIngredient =
  UseRecipeFormWrites_RecipeFragment['ingredientsConnection']['edges'][number]['node'];

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
  extends Partial<
    Omit<UseRecipeFormWrites_RecipeFragment, 'ingredientsConnection'>
  > {
  ingredients?: RecipeFormIngredient[];
  /** The page the device holds; a recipe over the ingredient limit has a next one. */
  ingredientsPage?: {
    totalCount: number;
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

/**
 * `useRecipeFormWrites_recipe` complete, for the editor's own reads and for a
 * `seedCache` held to that fragment: a draft with no optional field set and its
 * whole ingredient list on the device, unless stated.
 */
export const recipeFormFragment = ({
  ingredients = [],
  ingredientsPage,
  ...overrides
}: RecipeFormFixture = {}): UseRecipeFormWrites_RecipeFragment => ({
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

type RecipeRead = NonNullable<MockDataFor<typeof GetRecipeDocument>['recipe']>;
type RecipeReadIngredient = NonNullable<
  NonNullable<
    NonNullable<
      NonNullable<RecipeRead['ingredientsConnection']>['edges']
    >[number]
  >['node']
>;

/** A line of a recipe as its detail screen reads it: plain, unless stated. */
export const recipeIngredientRead = (
  id: string,
  name: string,
  overrides: RecipeReadIngredient = {},
): RecipeReadIngredient => ({
  __typename: 'RecipeIngredient',
  id,
  name,
  quantity: 1,
  originalText: name,
  estimatedPrice: null,
  item: null,
  unit: null,
  convertedQuantity: null,
  image: null,
  isOptional: false,
  notes: null,
  preparation: null,
  sortOrder: 0,
  section: null,
  ...overrides,
});

/**
 * A recipe as its detail screen reads it (`GetRecipe`): Ana's, complete, in
 * the app, unsaved and unrated, unless stated. Every flag is stated, since
 * completion would fill one with `true`.
 */
export const recipeRead = ({
  ingredients = [],
  ...overrides
}: Omit<RecipeRead, 'ingredientsConnection'> & {
  ingredients?: RecipeReadIngredient[];
} = {}): RecipeRead => ({
  __typename: 'Recipe',
  id: 'recipe-1',
  version: 1,
  name: 'Lasagna',
  description: null,
  imageUrl: null,
  servings: 4,
  totalTimeMinutes: 45,
  caloriesPerServing: null,
  nutritionPerServing: null,
  status: RecipeStatus.Published,
  isPublished: true,
  publishedAt: null,
  reviewNote: null,
  pendingRevision: null,
  latestRevision: null,
  forkedFromId: null,
  forkedFrom: null,
  originalAuthor: null,
  tips: null,
  videoUrl: null,
  tags: [],
  source: null,
  sourceUrl: null,
  dataAttributions: [],
  instructions: [],
  isExternal: false,
  sourceMapping: null,
  healthScore: null,
  diets: [],
  freeOf: [],
  savedDetails: null,
  averageRating: null,
  totalReviews: 0,
  rating1Count: 0,
  rating2Count: 0,
  rating3Count: 0,
  rating4Count: 0,
  rating5Count: 0,
  createdBy: {
    __typename: 'User',
    id: 'author-1',
    email: 'ana@example.com',
    displayName: 'Ana',
  },
  ingredientsConnection: {
    __typename: 'RecipeIngredientConnection',
    edges: ingredients.map(node => ({
      __typename: 'RecipeIngredientEdge',
      node,
    })),
    pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
    totalCount: ingredients.length,
  },
  ...overrides,
});
