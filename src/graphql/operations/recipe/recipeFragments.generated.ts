import type * as Types from '../../generated/schemaTypes';

import type { UserSummaryFragment } from '../auth/userFragments.generated';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type RecipeIngredientFragment = {
  __typename: 'RecipeIngredient';
  id: string;
  name: string;
  quantity: number;
  image: string | null;
  isOptional: boolean;
  notes: string | null;
  preparation: string | null;
  sortOrder: number;
  section: string | null;
  item: {
    __typename: 'Item';
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  unit: { __typename: 'Unit'; id: string; name: string; symbol: string } | null;
};

export type RecipeReviewFragment = {
  __typename: 'RecipeReview';
  id: string;
  rating: number;
  comment: string | null;
  helpful: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  user: { __typename: 'User' } & UserSummaryFragment;
  helpfulVotes: Array<{
    __typename: 'ReviewHelpful';
    id: string;
    user: { __typename: 'User'; id: string };
  }>;
};

export type BasicRecipeFragment = {
  __typename: 'Recipe';
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  servings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  difficulty: Types.Difficulty;
  category: Types.RecipeCategory;
  cuisine: string | null;
  status: Types.RecipeStatus;
  isExternal: boolean;
  externalSource: Types.ExternalSource | null;
  externalId: string | null;
  primarySource: string | null;
  caloriesPerServing: number | null;
  createdAt: string;
  updatedAt: string;
  savedDetails: {
    __typename: 'SavedRecipe';
    id: string;
    folder: string | null;
    tags: Array<string>;
    notes: string | null;
    personalRating: number | null;
    cookedCount: number;
  } | null;
};

export type RecipeFragment = {
  __typename: 'Recipe';
  instructions: any;
  notes: string | null;
  videoUrl: string | null;
  sourceUrl: string | null;
  source: string | null;
  isPublished: boolean;
  averageRating: number | null;
  totalReviews: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
  createdBy: { __typename: 'User'; id: string; email: string } | null;
  ingredients: Array<
    { __typename: 'RecipeIngredient' } & RecipeIngredientFragment
  >;
} & BasicRecipeFragment;

export const RecipeReviewFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RecipeReviewFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'RecipeReview' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating' } },
          { kind: 'Field', name: { kind: 'Name', value: 'comment' } },
          { kind: 'Field', name: { kind: 'Name', value: 'helpful' } },
          { kind: 'Field', name: { kind: 'Name', value: 'verified' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UserSummary' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'helpfulVotes' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'user' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSummary' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<RecipeReviewFragment, unknown>;
export const BasicRecipeFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BasicRecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'prepTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'cookTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'difficulty' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'cuisine' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isExternal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'externalSource' } },
          { kind: 'Field', name: { kind: 'Name', value: 'externalId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'primarySource' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'caloriesPerServing' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'savedDetails' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'folder' } },
                { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'personalRating' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'cookedCount' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<BasicRecipeFragment, unknown>;
export const RecipeIngredientFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RecipeIngredientFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'RecipeIngredient' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'image' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isOptional' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'preparation' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          { kind: 'Field', name: { kind: 'Name', value: 'section' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<RecipeIngredientFragment, unknown>;
export const RecipeFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'FragmentSpread',
            name: { kind: 'Name', value: 'BasicRecipeFragment' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'instructions' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'videoUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sourceUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'source' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPublished' } },
          { kind: 'Field', name: { kind: 'Name', value: 'averageRating' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalReviews' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating1Count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating2Count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating3Count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating4Count' } },
          { kind: 'Field', name: { kind: 'Name', value: 'rating5Count' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createdBy' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'ingredients' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'RecipeIngredientFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BasicRecipeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Recipe' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'servings' } },
          { kind: 'Field', name: { kind: 'Name', value: 'prepTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'cookTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'totalTimeMinutes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'difficulty' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'cuisine' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isExternal' } },
          { kind: 'Field', name: { kind: 'Name', value: 'externalSource' } },
          { kind: 'Field', name: { kind: 'Name', value: 'externalId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'primarySource' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'caloriesPerServing' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'savedDetails' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'folder' } },
                { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'personalRating' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'cookedCount' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RecipeIngredientFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'RecipeIngredient' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'quantity' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'item' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'imageUrl' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unit' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'symbol' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'image' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isOptional' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'preparation' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sortOrder' } },
          { kind: 'Field', name: { kind: 'Name', value: 'section' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<RecipeFragment, unknown>;
