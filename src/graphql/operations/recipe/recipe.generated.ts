import type * as Types from '../../generated/schemaTypes';

import type {
  BasicRecipeFragment,
  RecipeFragment,
  RecipeIngredientFragment,
  RecipeReviewFragment,
} from './recipeFragments.generated';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type SearchRecipesQueryVariables = Types.Exact<{
  query: Types.Scalars['String']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;

export type SearchRecipesQuery = {
  __typename: 'Query';
  searchRecipes: {
    __typename: 'RecipeConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'RecipeEdge';
      cursor: string;
      node: { __typename: 'Recipe' } & BasicRecipeFragment;
    }>;
    pageInfo: {
      __typename: 'PageInfo';
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

export type SuggestedRecipesQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;

export type SuggestedRecipesQuery = {
  __typename: 'Query';
  recipeSuggestions: {
    __typename: 'RecipeConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'RecipeEdge';
      cursor: string;
      node: { __typename: 'Recipe' } & BasicRecipeFragment;
    }>;
    pageInfo: {
      __typename: 'PageInfo';
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

export type MyRecipesQueryVariables = Types.Exact<{
  cursor?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  category?: Types.InputMaybe<Types.RecipeCategory>;
  difficulty?: Types.InputMaybe<Types.Difficulty>;
}>;

export type MyRecipesQuery = {
  __typename: 'Query';
  recipes: {
    __typename: 'RecipeConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'RecipeEdge';
      cursor: string;
      node: { __typename: 'Recipe' } & BasicRecipeFragment;
    }>;
    pageInfo: {
      __typename: 'PageInfo';
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

export type GetRecipeQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type GetRecipeQuery = {
  __typename: 'Query';
  recipe: ({ __typename: 'Recipe' } & RecipeFragment) | null;
};

export type GetRecipeReviewsQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type GetRecipeReviewsQuery = {
  __typename: 'Query';
  recipe: {
    __typename: 'Recipe';
    id: string;
    reviews: {
      __typename: 'RecipeReviewConnection';
      totalCount: number | null;
      edges: Array<{
        __typename: 'RecipeReviewEdge';
        node: { __typename: 'RecipeReview' } & RecipeReviewFragment;
      }>;
    };
  } | null;
};

export type MySavedRecipesQueryVariables = Types.Exact<{
  folder?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;

export type MySavedRecipesQuery = {
  __typename: 'Query';
  me: {
    __typename: 'User';
    id: string;
    savedRecipesConnection: {
      __typename: 'SavedRecipeConnection';
      totalCount: number | null;
      edges: Array<{
        __typename: 'SavedRecipeEdge';
        cursor: string;
        node: {
          __typename: 'SavedRecipe';
          id: string;
          folder: string | null;
          tags: Array<string>;
          notes: string | null;
          personalRating: number | null;
          cookedCount: number;
          lastCookedAt: string | null;
          createdAt: string;
          updatedAt: string;
          recipe: { __typename: 'Recipe' } & BasicRecipeFragment;
        };
      }>;
      pageInfo: {
        __typename: 'PageInfo';
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
};

export type SavedRecipeFoldersQueryVariables = Types.Exact<{
  [key: string]: never;
}>;

export type SavedRecipeFoldersQuery = {
  __typename: 'Query';
  savedRecipeFolders: Array<string>;
};

export type CreateRecipeMutationVariables = Types.Exact<{
  input: Types.CreateRecipeInput;
}>;

export type CreateRecipeMutation = {
  __typename: 'Mutation';
  createRecipe: {
    __typename: 'RecipePayload';
    success: boolean;
    message: string;
    code: string;
    recipe: ({ __typename: 'Recipe' } & BasicRecipeFragment) | null;
  };
};

export type UpsertExternalRecipeMutationVariables = Types.Exact<{
  input: Types.CreateRecipeInput;
}>;

export type UpsertExternalRecipeMutation = {
  __typename: 'Mutation';
  upsertExternalRecipe: {
    __typename: 'UpsertExternalRecipeResult';
    created: boolean;
    recipe: {
      __typename: 'Recipe';
      id: string;
      name: string;
      imageUrl: string | null;
      externalSource: Types.ExternalSource | null;
      externalId: string | null;
      servings: number;
      prepTimeMinutes: number | null;
      cookTimeMinutes: number | null;
      totalTimeMinutes: number | null;
    };
  };
};

export type UpdateRecipeMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateRecipeInput;
}>;

export type UpdateRecipeMutation = {
  __typename: 'Mutation';
  updateRecipe: {
    __typename: 'RecipePayload';
    success: boolean;
    message: string;
    code: string;
    recipe: ({ __typename: 'Recipe' } & RecipeFragment) | null;
  };
};

export type UpdateRecipeIngredientsMutationVariables = Types.Exact<{
  recipeId: Types.Scalars['ID']['input'];
  ingredients: Array<Types.RecipeIngredientInput> | Types.RecipeIngredientInput;
}>;

export type UpdateRecipeIngredientsMutation = {
  __typename: 'Mutation';
  updateRecipeIngredients: {
    __typename: 'RecipePayload';
    success: boolean;
    message: string;
    code: string;
    recipe: {
      __typename: 'Recipe';
      id: string;
      ingredients: Array<
        { __typename: 'RecipeIngredient' } & RecipeIngredientFragment
      >;
    } | null;
  };
};

export type DeleteRecipeMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type DeleteRecipeMutation = {
  __typename: 'Mutation';
  deleteRecipe: {
    __typename: 'RecipePayload';
    success: boolean;
    message: string;
    code: string;
    recipe: { __typename: 'Recipe'; id: string } | null;
  };
};

export type FavoriteRecipeMutationVariables = Types.Exact<{
  input: Types.FavoriteRecipeInput;
}>;

export type FavoriteRecipeMutation = {
  __typename: 'Mutation';
  favoriteRecipe: {
    __typename: 'SavedRecipePayload';
    success: boolean;
    message: string;
    code: string;
    savedRecipe: {
      __typename: 'SavedRecipe';
      id: string;
      recipeId: string;
      userId: string;
      folder: string | null;
      tags: Array<string>;
      notes: string | null;
      personalRating: number | null;
      cookedCount: number;
      lastCookedAt: string | null;
      createdAt: string;
      updatedAt: string;
      recipe: { __typename: 'Recipe' } & BasicRecipeFragment;
    } | null;
  };
};

export type UnfavoriteRecipeMutationVariables = Types.Exact<{
  recipeId: Types.Scalars['ID']['input'];
}>;

export type UnfavoriteRecipeMutation = {
  __typename: 'Mutation';
  unfavoriteRecipe: {
    __typename: 'SavedRecipePayload';
    success: boolean;
    message: string;
    code: string;
    savedRecipe: { __typename: 'SavedRecipe'; id: string } | null;
  };
};

export type DeleteRecipeFolderMutationVariables = Types.Exact<{
  input: Types.DeleteRecipeFolderInput;
}>;

export type DeleteRecipeFolderMutation = {
  __typename: 'Mutation';
  deleteRecipeFolder: {
    __typename: 'SavedRecipePayload';
    success: boolean;
    message: string;
    code: string;
  };
};

export type UpdateFavoriteRecipeMutationVariables = Types.Exact<{
  recipeId: Types.Scalars['ID']['input'];
  input: Types.UpdateFavoriteRecipeInput;
}>;

export type UpdateFavoriteRecipeMutation = {
  __typename: 'Mutation';
  updateFavoriteRecipe: {
    __typename: 'SavedRecipePayload';
    success: boolean;
    message: string;
    code: string;
    savedRecipe: {
      __typename: 'SavedRecipe';
      id: string;
      recipeId: string;
      userId: string;
      folder: string | null;
      tags: Array<string>;
      notes: string | null;
      personalRating: number | null;
      cookedCount: number;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
};

export type CreateShoppingListItemsFromRecipeMutationVariables = Types.Exact<{
  input: Types.CreateShoppingListItemsFromRecipeInput;
}>;

export type CreateShoppingListItemsFromRecipeMutation = {
  __typename: 'Mutation';
  createShoppingListItemsFromRecipe: {
    __typename: 'AddRecipeToShoppingListResult';
    totalAdded: number;
    totalUpdated: number;
    totalSkipped: number;
    addedItems: Array<{
      __typename: 'ShoppingListItem';
      id: string;
      itemName: string | null;
      quantity: number | null;
      unit: {
        __typename: 'Unit';
        id: string;
        name: string;
        symbol: string;
      } | null;
      storeInfo: {
        __typename: 'ShoppingListItemStoreInfo';
        aisle: string | null;
      };
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo';
        isPurchased: boolean;
      };
    }>;
    updatedItems: Array<{
      __typename: 'ShoppingListItem';
      id: string;
      itemName: string | null;
      quantity: number | null;
      unit: {
        __typename: 'Unit';
        id: string;
        name: string;
        symbol: string;
      } | null;
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo';
        isPurchased: boolean;
      };
    }>;
    skippedItems: Array<{
      __typename: 'RecipeIngredient';
      id: string;
      name: string;
      quantity: number;
    }>;
  };
};

export type CreateShoppingListItemFromRecipeIngredientMutationVariables =
  Types.Exact<{
    recipeIngredientId: Types.Scalars['ID']['input'];
    shoppingListId: Types.Scalars['ID']['input'];
    quantityOverride?: Types.InputMaybe<Types.Scalars['Float']['input']>;
  }>;

export type CreateShoppingListItemFromRecipeIngredientMutation = {
  __typename: 'Mutation';
  createShoppingListItemFromRecipeIngredient: {
    __typename: 'AddIngredientResult';
    previousQuantity: number | null;
    quantityAdded: number;
    wasUpdated: boolean;
    unitConversionApplied: boolean;
    shoppingListItem: {
      __typename: 'ShoppingListItem';
      id: string;
      itemName: string | null;
      quantity: number | null;
      unit: {
        __typename: 'Unit';
        id: string;
        name: string;
        symbol: string;
      } | null;
    };
  };
};

export type MatchRecipeIngredientsToPantryQueryVariables = Types.Exact<{
  pantryId: Types.Scalars['ID']['input'];
  recipeId: Types.Scalars['ID']['input'];
  servings?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type MatchRecipeIngredientsToPantryQuery = {
  __typename: 'Query';
  matchRecipeIngredientsToPantry: Array<{
    __typename: 'RecipeIngredientMatch';
    isAvailable: boolean;
    matchConfidence: number;
    availableQuantity: number;
    suggestedQuantity: number;
    shortfall: number | null;
    ingredient: { __typename: 'RecipeIngredient' } & RecipeIngredientFragment;
    suggestedUnit: {
      __typename: 'Unit';
      id: string;
      name: string;
      symbol: string;
    } | null;
    matchedPantryItem: {
      __typename: 'PantryItem';
      id: string;
      itemName: string;
      quantity: number;
      unit: {
        __typename: 'Unit';
        id: string;
        name: string;
        symbol: string;
      } | null;
    } | null;
  }>;
};

export type ConfirmRecipeConsumptionMutationVariables = Types.Exact<{
  input: Types.ConfirmRecipeConsumptionInput;
}>;

export type ConfirmRecipeConsumptionMutation = {
  __typename: 'Mutation';
  confirmRecipeConsumption: {
    __typename: 'RecipeConsumptionResult';
    success: boolean;
    totalConsumed: number;
    totalFailed: number;
    cookingLog: {
      __typename: 'CookingLog';
      id: string;
      servingsMade: number | null;
      notes: string | null;
      cookedAt: string;
    } | null;
  };
};

export type MarkRecipeAsCookedMutationVariables = Types.Exact<{
  input: Types.MarkRecipeAsCookedInput;
}>;

export type MarkRecipeAsCookedMutation = {
  __typename: 'Mutation';
  markRecipeAsCooked: {
    __typename: 'CookingLogPayload';
    success: boolean;
    message: string;
    code: string;
    cookingLog: {
      __typename: 'CookingLog';
      id: string;
      servingsMade: number | null;
      notes: string | null;
      cookedAt: string;
      recipe: { __typename: 'Recipe'; id: string; name: string };
    } | null;
  };
};

export const SearchRecipesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'SearchRecipes' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'query' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'String' },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'first' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'after' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'searchRecipes' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'query' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'query' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'first' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'after' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'after' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'edges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'node' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'BasicRecipeFragment',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cursor' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pageInfo' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'hasNextPage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'endCursor' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
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
  ],
} as unknown as DocumentNode<SearchRecipesQuery, SearchRecipesQueryVariables>;
export const SuggestedRecipesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'SuggestedRecipes' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'first' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'after' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipeSuggestions' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'first' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'after' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'after' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'edges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'node' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'BasicRecipeFragment',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cursor' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pageInfo' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'hasNextPage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'endCursor' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
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
  ],
} as unknown as DocumentNode<
  SuggestedRecipesQuery,
  SuggestedRecipesQueryVariables
>;
export const MyRecipesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'MyRecipes' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'cursor' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'first' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          defaultValue: { kind: 'IntValue', value: '25' },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'category' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'RecipeCategory' },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'difficulty' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'Difficulty' },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipes' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'after' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'cursor' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'first' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'category' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'category' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'difficulty' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'difficulty' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'edges' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'node' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'BasicRecipeFragment',
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cursor' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pageInfo' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'hasNextPage' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'endCursor' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
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
  ],
} as unknown as DocumentNode<MyRecipesQuery, MyRecipesQueryVariables>;
export const GetRecipeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetRecipe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'RecipeFragment' },
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
  ],
} as unknown as DocumentNode<GetRecipeQuery, GetRecipeQueryVariables>;
export const GetRecipeReviewsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetRecipeReviews' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'recipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'reviews' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'edges' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'node' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: {
                                      kind: 'Name',
                                      value: 'RecipeReviewFragment',
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCount' },
                      },
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
  ],
} as unknown as DocumentNode<
  GetRecipeReviewsQuery,
  GetRecipeReviewsQueryVariables
>;
export const MySavedRecipesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'MySavedRecipes' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'folder' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'first' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'after' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'me' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'savedRecipesConnection' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'folder' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'folder' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'first' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'first' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'after' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'after' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'edges' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'node' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'id' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'folder' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'tags' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'notes' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'personalRating',
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'cookedCount',
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'lastCookedAt',
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'createdAt' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'updatedAt' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'recipe' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'FragmentSpread',
                                          name: {
                                            kind: 'Name',
                                            value: 'BasicRecipeFragment',
                                          },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'cursor' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pageInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'hasNextPage' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'endCursor' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalCount' },
                      },
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
} as unknown as DocumentNode<MySavedRecipesQuery, MySavedRecipesQueryVariables>;
export const SavedRecipeFoldersDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'SavedRecipeFolders' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'savedRecipeFolders' },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SavedRecipeFoldersQuery,
  SavedRecipeFoldersQueryVariables
>;
export const CreateRecipeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateRecipe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CreateRecipeInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createRecipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'recipe' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'BasicRecipeFragment' },
                      },
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
} as unknown as DocumentNode<
  CreateRecipeMutation,
  CreateRecipeMutationVariables
>;
export const UpsertExternalRecipeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpsertExternalRecipe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'CreateRecipeInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'upsertExternalRecipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'recipe' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'imageUrl' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'externalSource' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'externalId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'servings' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'prepTimeMinutes' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cookTimeMinutes' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'totalTimeMinutes' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'created' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpsertExternalRecipeMutation,
  UpsertExternalRecipeMutationVariables
>;
export const UpdateRecipeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateRecipe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'UpdateRecipeInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateRecipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'recipe' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'RecipeFragment' },
                      },
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
  ],
} as unknown as DocumentNode<
  UpdateRecipeMutation,
  UpdateRecipeMutationVariables
>;
export const UpdateRecipeIngredientsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateRecipeIngredients' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'recipeId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'ingredients' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: {
                  kind: 'NamedType',
                  name: { kind: 'Name', value: 'RecipeIngredientInput' },
                },
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateRecipeIngredients' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'recipeId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'recipeId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ingredients' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'ingredients' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'recipe' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'ingredients' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'RecipeIngredientFragment',
                              },
                            },
                          ],
                        },
                      },
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
} as unknown as DocumentNode<
  UpdateRecipeIngredientsMutation,
  UpdateRecipeIngredientsMutationVariables
>;
export const DeleteRecipeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteRecipe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deleteRecipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'recipe' },
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
  ],
} as unknown as DocumentNode<
  DeleteRecipeMutation,
  DeleteRecipeMutationVariables
>;
export const FavoriteRecipeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'FavoriteRecipe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'FavoriteRecipeInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'favoriteRecipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'savedRecipe' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'recipeId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'userId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'folder' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'personalRating' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cookedCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastCookedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'recipe' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: {
                                kind: 'Name',
                                value: 'BasicRecipeFragment',
                              },
                            },
                          ],
                        },
                      },
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
} as unknown as DocumentNode<
  FavoriteRecipeMutation,
  FavoriteRecipeMutationVariables
>;
export const UnfavoriteRecipeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UnfavoriteRecipe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'recipeId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'unfavoriteRecipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'recipeId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'recipeId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'savedRecipe' },
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
  ],
} as unknown as DocumentNode<
  UnfavoriteRecipeMutation,
  UnfavoriteRecipeMutationVariables
>;
export const DeleteRecipeFolderDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteRecipeFolder' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'DeleteRecipeFolderInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deleteRecipeFolder' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  DeleteRecipeFolderMutation,
  DeleteRecipeFolderMutationVariables
>;
export const UpdateFavoriteRecipeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateFavoriteRecipe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'recipeId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'UpdateFavoriteRecipeInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateFavoriteRecipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'recipeId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'recipeId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'savedRecipe' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'recipeId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'userId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'folder' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'personalRating' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cookedCount' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateFavoriteRecipeMutation,
  UpdateFavoriteRecipeMutationVariables
>;
export const CreateShoppingListItemsFromRecipeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateShoppingListItemsFromRecipe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: {
                kind: 'Name',
                value: 'CreateShoppingListItemsFromRecipeInput',
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createShoppingListItemsFromRecipe' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'addedItems' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'unit' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'symbol' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'storeInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'aisle' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'purchaseInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'isPurchased' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'updatedItems' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'unit' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'symbol' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'purchaseInfo' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'isPurchased' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'skippedItems' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantity' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalAdded' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalUpdated' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalSkipped' },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateShoppingListItemsFromRecipeMutation,
  CreateShoppingListItemsFromRecipeMutationVariables
>;
export const CreateShoppingListItemFromRecipeIngredientDocument =
  /*#__PURE__*/ {
    kind: 'Document',
    definitions: [
      {
        kind: 'OperationDefinition',
        operation: 'mutation',
        name: {
          kind: 'Name',
          value: 'CreateShoppingListItemFromRecipeIngredient',
        },
        variableDefinitions: [
          {
            kind: 'VariableDefinition',
            variable: {
              kind: 'Variable',
              name: { kind: 'Name', value: 'recipeIngredientId' },
            },
            type: {
              kind: 'NonNullType',
              type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
            },
          },
          {
            kind: 'VariableDefinition',
            variable: {
              kind: 'Variable',
              name: { kind: 'Name', value: 'shoppingListId' },
            },
            type: {
              kind: 'NonNullType',
              type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
            },
          },
          {
            kind: 'VariableDefinition',
            variable: {
              kind: 'Variable',
              name: { kind: 'Name', value: 'quantityOverride' },
            },
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Float' } },
          },
        ],
        selectionSet: {
          kind: 'SelectionSet',
          selections: [
            {
              kind: 'Field',
              name: {
                kind: 'Name',
                value: 'createShoppingListItemFromRecipeIngredient',
              },
              arguments: [
                {
                  kind: 'Argument',
                  name: { kind: 'Name', value: 'recipeIngredientId' },
                  value: {
                    kind: 'Variable',
                    name: { kind: 'Name', value: 'recipeIngredientId' },
                  },
                },
                {
                  kind: 'Argument',
                  name: { kind: 'Name', value: 'shoppingListId' },
                  value: {
                    kind: 'Variable',
                    name: { kind: 'Name', value: 'shoppingListId' },
                  },
                },
                {
                  kind: 'Argument',
                  name: { kind: 'Name', value: 'quantityOverride' },
                  value: {
                    kind: 'Variable',
                    name: { kind: 'Name', value: 'quantityOverride' },
                  },
                },
              ],
              selectionSet: {
                kind: 'SelectionSet',
                selections: [
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: 'shoppingListItem' },
                    selectionSet: {
                      kind: 'SelectionSet',
                      selections: [
                        { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                        {
                          kind: 'Field',
                          name: { kind: 'Name', value: 'itemName' },
                        },
                        {
                          kind: 'Field',
                          name: { kind: 'Name', value: 'quantity' },
                        },
                        {
                          kind: 'Field',
                          name: { kind: 'Name', value: 'unit' },
                          selectionSet: {
                            kind: 'SelectionSet',
                            selections: [
                              {
                                kind: 'Field',
                                name: { kind: 'Name', value: 'id' },
                              },
                              {
                                kind: 'Field',
                                name: { kind: 'Name', value: 'name' },
                              },
                              {
                                kind: 'Field',
                                name: { kind: 'Name', value: 'symbol' },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: 'previousQuantity' },
                  },
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: 'quantityAdded' },
                  },
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: 'wasUpdated' },
                  },
                  {
                    kind: 'Field',
                    name: { kind: 'Name', value: 'unitConversionApplied' },
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  } as unknown as DocumentNode<
    CreateShoppingListItemFromRecipeIngredientMutation,
    CreateShoppingListItemFromRecipeIngredientMutationVariables
  >;
export const MatchRecipeIngredientsToPantryDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'MatchRecipeIngredientsToPantry' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'pantryId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'recipeId' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'servings' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'matchRecipeIngredientsToPantry' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'pantryId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'pantryId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'recipeId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'recipeId' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'servings' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'servings' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'ingredient' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'RecipeIngredientFragment',
                        },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'isAvailable' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'matchConfidence' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'availableQuantity' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'suggestedQuantity' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'shortfall' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'suggestedUnit' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'symbol' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'matchedPantryItem' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'itemName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quantity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'unit' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'symbol' },
                            },
                          ],
                        },
                      },
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
} as unknown as DocumentNode<
  MatchRecipeIngredientsToPantryQuery,
  MatchRecipeIngredientsToPantryQueryVariables
>;
export const ConfirmRecipeConsumptionDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'ConfirmRecipeConsumption' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'ConfirmRecipeConsumptionInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'confirmRecipeConsumption' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'totalConsumed' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'totalFailed' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'cookingLog' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'servingsMade' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cookedAt' },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ConfirmRecipeConsumptionMutation,
  ConfirmRecipeConsumptionMutationVariables
>;
export const MarkRecipeAsCookedDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'MarkRecipeAsCooked' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'input' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'MarkRecipeAsCookedInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'markRecipeAsCooked' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'input' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'cookingLog' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'servingsMade' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cookedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'recipe' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'name' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  MarkRecipeAsCookedMutation,
  MarkRecipeAsCookedMutationVariables
>;
