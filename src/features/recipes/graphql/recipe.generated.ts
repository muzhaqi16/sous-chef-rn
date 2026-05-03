// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type { BasicRecipeFragment, RecipeFragment, RecipeIngredientFragment, RecipeReviewFragment } from '../../../graphql/operations/fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type SearchRecipesQueryVariables = Types.Exact<{
  query: Types.Scalars['String']['input'];
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type SearchRecipesQuery = { __typename: 'Query', searchRecipes: { __typename: 'RecipeConnection', totalCount: number | null, edges: Array<{ __typename: 'RecipeEdge', cursor: string, node: (
        { __typename: 'Recipe' }
        & BasicRecipeFragment
      ) }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type SuggestedRecipesQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type SuggestedRecipesQuery = { __typename: 'Query', recipeSuggestions: { __typename: 'RecipeConnection', totalCount: number | null, edges: Array<{ __typename: 'RecipeEdge', cursor: string, node: (
        { __typename: 'Recipe' }
        & BasicRecipeFragment
      ) }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type MyRecipesQueryVariables = Types.Exact<{
  cursor?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  category?: Types.InputMaybe<Types.RecipeCategory>;
  difficulty?: Types.InputMaybe<Types.Difficulty>;
}>;


export type MyRecipesQuery = { __typename: 'Query', recipes: { __typename: 'RecipeConnection', totalCount: number | null, edges: Array<{ __typename: 'RecipeEdge', cursor: string, node: (
        { __typename: 'Recipe' }
        & BasicRecipeFragment
      ) }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type GetRecipeQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetRecipeQuery = { __typename: 'Query', recipe: (
    { __typename: 'Recipe' }
    & RecipeFragment
  ) | null };

export type GetRecipeReviewsQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetRecipeReviewsQuery = { __typename: 'Query', recipe: { __typename: 'Recipe', id: string, reviews: { __typename: 'RecipeReviewConnection', totalCount: number | null, edges: Array<{ __typename: 'RecipeReviewEdge', node: (
          { __typename: 'RecipeReview' }
          & RecipeReviewFragment
        ) }> } } | null };

export type MySavedRecipesQueryVariables = Types.Exact<{
  folder?: Types.InputMaybe<Types.Scalars['String']['input']>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type MySavedRecipesQuery = { __typename: 'Query', me: { __typename: 'User', id: string, savedRecipesConnection: { __typename: 'SavedRecipeConnection', totalCount: number | null, edges: Array<{ __typename: 'SavedRecipeEdge', cursor: string, node: { __typename: 'SavedRecipe', id: string, folder: string | null, tags: Array<string>, notes: string | null, personalRating: number | null, cookedCount: number, lastCookedAt: string | null, createdAt: string, updatedAt: string, recipe: (
            { __typename: 'Recipe' }
            & BasicRecipeFragment
          ) } }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } } | null };

export type SavedRecipeFoldersQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type SavedRecipeFoldersQuery = { __typename: 'Query', savedRecipeFolders: Array<string> };

export type CreateRecipeMutationVariables = Types.Exact<{
  input: Types.CreateRecipeInput;
}>;


export type CreateRecipeMutation = { __typename: 'Mutation', createRecipe: { __typename: 'RecipePayload', success: boolean, message: string, code: string, recipe: (
      { __typename: 'Recipe' }
      & BasicRecipeFragment
    ) | null } };

export type UpsertExternalRecipeMutationVariables = Types.Exact<{
  input: Types.CreateRecipeInput;
}>;


export type UpsertExternalRecipeMutation = { __typename: 'Mutation', upsertExternalRecipe: { __typename: 'UpsertExternalRecipeResult', created: boolean, recipe: { __typename: 'Recipe', id: string, name: string, imageUrl: string | null, externalSource: Types.ExternalSource | null, externalId: string | null, servings: number, prepTimeMinutes: number | null, cookTimeMinutes: number | null, totalTimeMinutes: number | null } } };

export type UpdateRecipeMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateRecipeInput;
}>;


export type UpdateRecipeMutation = { __typename: 'Mutation', updateRecipe: { __typename: 'RecipePayload', success: boolean, message: string, code: string, recipe: (
      { __typename: 'Recipe' }
      & RecipeFragment
    ) | null } };

export type UpdateRecipeIngredientsMutationVariables = Types.Exact<{
  recipeId: Types.Scalars['ID']['input'];
  ingredients: Array<Types.RecipeIngredientInput> | Types.RecipeIngredientInput;
}>;


export type UpdateRecipeIngredientsMutation = { __typename: 'Mutation', updateRecipeIngredients: { __typename: 'RecipePayload', success: boolean, message: string, code: string, recipe: { __typename: 'Recipe', id: string, ingredients: Array<(
        { __typename: 'RecipeIngredient' }
        & RecipeIngredientFragment
      )> } | null } };

export type DeleteRecipeMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteRecipeMutation = { __typename: 'Mutation', deleteRecipe: { __typename: 'RecipePayload', success: boolean, message: string, code: string, recipe: { __typename: 'Recipe', id: string } | null } };

export type FavoriteRecipeMutationVariables = Types.Exact<{
  input: Types.FavoriteRecipeInput;
}>;


export type FavoriteRecipeMutation = { __typename: 'Mutation', favoriteRecipe: { __typename: 'SavedRecipePayload', success: boolean, message: string, code: string, savedRecipe: { __typename: 'SavedRecipe', id: string, recipeId: string, userId: string, folder: string | null, tags: Array<string>, notes: string | null, personalRating: number | null, cookedCount: number, lastCookedAt: string | null, createdAt: string, updatedAt: string, recipe: (
        { __typename: 'Recipe' }
        & BasicRecipeFragment
      ) } | null } };

export type UnfavoriteRecipeMutationVariables = Types.Exact<{
  recipeId: Types.Scalars['ID']['input'];
}>;


export type UnfavoriteRecipeMutation = { __typename: 'Mutation', unfavoriteRecipe: { __typename: 'SavedRecipePayload', success: boolean, message: string, code: string, savedRecipe: { __typename: 'SavedRecipe', id: string } | null } };

export type DeleteRecipeFolderMutationVariables = Types.Exact<{
  input: Types.DeleteRecipeFolderInput;
}>;


export type DeleteRecipeFolderMutation = { __typename: 'Mutation', deleteRecipeFolder: { __typename: 'SavedRecipePayload', success: boolean, message: string, code: string } };

export type UpdateFavoriteRecipeMutationVariables = Types.Exact<{
  recipeId: Types.Scalars['ID']['input'];
  input: Types.UpdateFavoriteRecipeInput;
}>;


export type UpdateFavoriteRecipeMutation = { __typename: 'Mutation', updateFavoriteRecipe: { __typename: 'SavedRecipePayload', success: boolean, message: string, code: string, savedRecipe: { __typename: 'SavedRecipe', id: string, recipeId: string, userId: string, folder: string | null, tags: Array<string>, notes: string | null, personalRating: number | null, cookedCount: number, createdAt: string, updatedAt: string } | null } };

export type CreateShoppingListItemsFromRecipeMutationVariables = Types.Exact<{
  input: Types.CreateShoppingListItemsFromRecipeInput;
}>;


export type CreateShoppingListItemsFromRecipeMutation = { __typename: 'Mutation', createShoppingListItemsFromRecipe: { __typename: 'AddRecipeToShoppingListResult', totalAdded: number, totalUpdated: number, totalSkipped: number, addedItems: Array<{ __typename: 'ShoppingListItem', id: string, itemName: string | null, quantity: number | null, unit: { __typename: 'Unit', id: string, name: string, symbol: string } | null, storeInfo: { __typename: 'ShoppingListItemStoreInfo', aisle: string | null }, purchaseInfo: { __typename: 'ShoppingListItemPurchaseInfo', isPurchased: boolean } }>, updatedItems: Array<{ __typename: 'ShoppingListItem', id: string, itemName: string | null, quantity: number | null, unit: { __typename: 'Unit', id: string, name: string, symbol: string } | null, purchaseInfo: { __typename: 'ShoppingListItemPurchaseInfo', isPurchased: boolean } }>, skippedItems: Array<{ __typename: 'RecipeIngredient', id: string, name: string, quantity: number }> } };

export type CreateShoppingListItemFromRecipeIngredientMutationVariables = Types.Exact<{
  recipeIngredientId: Types.Scalars['ID']['input'];
  shoppingListId: Types.Scalars['ID']['input'];
  quantityOverride?: Types.InputMaybe<Types.Scalars['Float']['input']>;
}>;


export type CreateShoppingListItemFromRecipeIngredientMutation = { __typename: 'Mutation', createShoppingListItemFromRecipeIngredient: { __typename: 'AddIngredientResult', previousQuantity: number | null, quantityAdded: number, wasUpdated: boolean, unitConversionApplied: boolean, shoppingListItem: { __typename: 'ShoppingListItem', id: string, itemName: string | null, quantity: number | null, unit: { __typename: 'Unit', id: string, name: string, symbol: string } | null } } };

export type MatchRecipeIngredientsToPantryQueryVariables = Types.Exact<{
  pantryId: Types.Scalars['ID']['input'];
  recipeId: Types.Scalars['ID']['input'];
  servings?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type MatchRecipeIngredientsToPantryQuery = { __typename: 'Query', matchRecipeIngredientsToPantry: Array<{ __typename: 'RecipeIngredientMatch', isAvailable: boolean, matchConfidence: number, availableQuantity: number, suggestedQuantity: number, shortfall: number | null, ingredient: (
      { __typename: 'RecipeIngredient' }
      & RecipeIngredientFragment
    ), suggestedUnit: { __typename: 'Unit', id: string, name: string, symbol: string } | null, matchedPantryItem: { __typename: 'PantryItem', id: string, itemName: string, quantity: number, unit: { __typename: 'Unit', id: string, name: string, symbol: string } | null } | null }> };

export type ConfirmRecipeConsumptionMutationVariables = Types.Exact<{
  input: Types.ConfirmRecipeConsumptionInput;
}>;


export type ConfirmRecipeConsumptionMutation = { __typename: 'Mutation', confirmRecipeConsumption: { __typename: 'RecipeConsumptionResult', success: boolean, totalConsumed: number, totalFailed: number, cookingLog: { __typename: 'CookingLog', id: string, servingsMade: number | null, notes: string | null, cookedAt: string } | null } };

export type MarkRecipeAsCookedMutationVariables = Types.Exact<{
  input: Types.MarkRecipeAsCookedInput;
}>;


export type MarkRecipeAsCookedMutation = { __typename: 'Mutation', markRecipeAsCooked: { __typename: 'CookingLogPayload', success: boolean, message: string, code: string, cookingLog: { __typename: 'CookingLog', id: string, servingsMade: number | null, notes: string | null, cookedAt: string, recipe: { __typename: 'Recipe', id: string, name: string } } | null } };


export const SearchRecipesDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchRecipes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchRecipes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicRecipeFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"prepTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"cookTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"cuisine"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalSource"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"primarySource"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesPerServing"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"savedDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useSearchRecipesQuery__
 *
 * To run a query within a React component, call `useSearchRecipesQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchRecipesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchRecipesQuery({
 *   variables: {
 *      query: // value for 'query'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useSearchRecipesQuery(baseOptions: ApolloReactHooks.QueryHookOptions<SearchRecipesQuery, SearchRecipesQueryVariables> & ({ variables: SearchRecipesQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<SearchRecipesQuery, SearchRecipesQueryVariables>(SearchRecipesDocument, options);
      }
export function useSearchRecipesLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<SearchRecipesQuery, SearchRecipesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<SearchRecipesQuery, SearchRecipesQueryVariables>(SearchRecipesDocument, options);
        }
// @ts-ignore
export function useSearchRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<SearchRecipesQuery, SearchRecipesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SearchRecipesQuery, SearchRecipesQueryVariables>;
export function useSearchRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SearchRecipesQuery, SearchRecipesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SearchRecipesQuery | undefined, SearchRecipesQueryVariables>;
export function useSearchRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SearchRecipesQuery, SearchRecipesQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<SearchRecipesQuery, SearchRecipesQueryVariables>(SearchRecipesDocument, options);
        }
export type SearchRecipesQueryHookResult = ReturnType<typeof useSearchRecipesQuery>;
export type SearchRecipesLazyQueryHookResult = ReturnType<typeof useSearchRecipesLazyQuery>;
export type SearchRecipesSuspenseQueryHookResult = ReturnType<typeof useSearchRecipesSuspenseQuery>;
export type SearchRecipesQueryResult = ApolloReactCommon.QueryResult<SearchRecipesQuery, SearchRecipesQueryVariables>;
export const SuggestedRecipesDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SuggestedRecipes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recipeSuggestions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicRecipeFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"prepTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"cookTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"cuisine"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalSource"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"primarySource"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesPerServing"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"savedDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useSuggestedRecipesQuery__
 *
 * To run a query within a React component, call `useSuggestedRecipesQuery` and pass it any options that fit your needs.
 * When your component renders, `useSuggestedRecipesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSuggestedRecipesQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useSuggestedRecipesQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>(SuggestedRecipesDocument, options);
      }
export function useSuggestedRecipesLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>(SuggestedRecipesDocument, options);
        }
// @ts-ignore
export function useSuggestedRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>;
export function useSuggestedRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SuggestedRecipesQuery | undefined, SuggestedRecipesQueryVariables>;
export function useSuggestedRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>(SuggestedRecipesDocument, options);
        }
export type SuggestedRecipesQueryHookResult = ReturnType<typeof useSuggestedRecipesQuery>;
export type SuggestedRecipesLazyQueryHookResult = ReturnType<typeof useSuggestedRecipesLazyQuery>;
export type SuggestedRecipesSuspenseQueryHookResult = ReturnType<typeof useSuggestedRecipesSuspenseQuery>;
export type SuggestedRecipesQueryResult = ApolloReactCommon.QueryResult<SuggestedRecipesQuery, SuggestedRecipesQueryVariables>;
export const MyRecipesDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyRecipes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"25"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"category"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"RecipeCategory"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"difficulty"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Difficulty"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recipes"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"cursor"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"category"},"value":{"kind":"Variable","name":{"kind":"Name","value":"category"}}},{"kind":"Argument","name":{"kind":"Name","value":"difficulty"},"value":{"kind":"Variable","name":{"kind":"Name","value":"difficulty"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicRecipeFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"prepTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"cookTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"cuisine"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalSource"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"primarySource"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesPerServing"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"savedDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useMyRecipesQuery__
 *
 * To run a query within a React component, call `useMyRecipesQuery` and pass it any options that fit your needs.
 * When your component renders, `useMyRecipesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMyRecipesQuery({
 *   variables: {
 *      cursor: // value for 'cursor'
 *      first: // value for 'first'
 *      category: // value for 'category'
 *      difficulty: // value for 'difficulty'
 *   },
 * });
 */
export function useMyRecipesQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<MyRecipesQuery, MyRecipesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<MyRecipesQuery, MyRecipesQueryVariables>(MyRecipesDocument, options);
      }
export function useMyRecipesLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<MyRecipesQuery, MyRecipesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<MyRecipesQuery, MyRecipesQueryVariables>(MyRecipesDocument, options);
        }
// @ts-ignore
export function useMyRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<MyRecipesQuery, MyRecipesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<MyRecipesQuery, MyRecipesQueryVariables>;
export function useMyRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<MyRecipesQuery, MyRecipesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<MyRecipesQuery | undefined, MyRecipesQueryVariables>;
export function useMyRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<MyRecipesQuery, MyRecipesQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<MyRecipesQuery, MyRecipesQueryVariables>(MyRecipesDocument, options);
        }
export type MyRecipesQueryHookResult = ReturnType<typeof useMyRecipesQuery>;
export type MyRecipesLazyQueryHookResult = ReturnType<typeof useMyRecipesLazyQuery>;
export type MyRecipesSuspenseQueryHookResult = ReturnType<typeof useMyRecipesSuspenseQuery>;
export type MyRecipesQueryResult = ApolloReactCommon.QueryResult<MyRecipesQuery, MyRecipesQueryVariables>;
export const GetRecipeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRecipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RecipeFragment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"prepTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"cookTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"cuisine"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalSource"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"primarySource"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesPerServing"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"savedDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicRecipeFragment"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUrl"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"totalReviews"}},{"kind":"Field","name":{"kind":"Name","value":"rating1Count"}},{"kind":"Field","name":{"kind":"Name","value":"rating2Count"}},{"kind":"Field","name":{"kind":"Name","value":"rating3Count"}},{"kind":"Field","name":{"kind":"Name","value":"rating4Count"}},{"kind":"Field","name":{"kind":"Name","value":"rating5Count"}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicUser"}}]}},{"kind":"Field","name":{"kind":"Name","value":"ingredients"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RecipeIngredientFragment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicUser"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RecipeIngredientFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecipeIngredient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"item"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"isOptional"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"preparation"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"section"}}]}}]} as unknown as DocumentNode;

/**
 * __useGetRecipeQuery__
 *
 * To run a query within a React component, call `useGetRecipeQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRecipeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRecipeQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetRecipeQuery(baseOptions: ApolloReactHooks.QueryHookOptions<GetRecipeQuery, GetRecipeQueryVariables> & ({ variables: GetRecipeQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetRecipeQuery, GetRecipeQueryVariables>(GetRecipeDocument, options);
      }
export function useGetRecipeLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetRecipeQuery, GetRecipeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetRecipeQuery, GetRecipeQueryVariables>(GetRecipeDocument, options);
        }
// @ts-ignore
export function useGetRecipeSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetRecipeQuery, GetRecipeQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetRecipeQuery, GetRecipeQueryVariables>;
export function useGetRecipeSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetRecipeQuery, GetRecipeQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetRecipeQuery | undefined, GetRecipeQueryVariables>;
export function useGetRecipeSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetRecipeQuery, GetRecipeQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetRecipeQuery, GetRecipeQueryVariables>(GetRecipeDocument, options);
        }
export type GetRecipeQueryHookResult = ReturnType<typeof useGetRecipeQuery>;
export type GetRecipeLazyQueryHookResult = ReturnType<typeof useGetRecipeLazyQuery>;
export type GetRecipeSuspenseQueryHookResult = ReturnType<typeof useGetRecipeSuspenseQuery>;
export type GetRecipeQueryResult = ApolloReactCommon.QueryResult<GetRecipeQuery, GetRecipeQueryVariables>;
export const GetRecipeReviewsDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRecipeReviews"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"reviews"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RecipeReviewFragment"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RecipeReviewFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecipeReview"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"helpful"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserSummary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"helpfulVotes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useGetRecipeReviewsQuery__
 *
 * To run a query within a React component, call `useGetRecipeReviewsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetRecipeReviewsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetRecipeReviewsQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetRecipeReviewsQuery(baseOptions: ApolloReactHooks.QueryHookOptions<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables> & ({ variables: GetRecipeReviewsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables>(GetRecipeReviewsDocument, options);
      }
export function useGetRecipeReviewsLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables>(GetRecipeReviewsDocument, options);
        }
// @ts-ignore
export function useGetRecipeReviewsSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables>;
export function useGetRecipeReviewsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetRecipeReviewsQuery | undefined, GetRecipeReviewsQueryVariables>;
export function useGetRecipeReviewsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables>(GetRecipeReviewsDocument, options);
        }
export type GetRecipeReviewsQueryHookResult = ReturnType<typeof useGetRecipeReviewsQuery>;
export type GetRecipeReviewsLazyQueryHookResult = ReturnType<typeof useGetRecipeReviewsLazyQuery>;
export type GetRecipeReviewsSuspenseQueryHookResult = ReturnType<typeof useGetRecipeReviewsSuspenseQuery>;
export type GetRecipeReviewsQueryResult = ApolloReactCommon.QueryResult<GetRecipeReviewsQuery, GetRecipeReviewsQueryVariables>;
export const MySavedRecipesDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MySavedRecipes"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"folder"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"savedRecipesConnection"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"folder"},"value":{"kind":"Variable","name":{"kind":"Name","value":"folder"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastCookedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicRecipeFragment"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"prepTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"cookTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"cuisine"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalSource"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"primarySource"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesPerServing"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"savedDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useMySavedRecipesQuery__
 *
 * To run a query within a React component, call `useMySavedRecipesQuery` and pass it any options that fit your needs.
 * When your component renders, `useMySavedRecipesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMySavedRecipesQuery({
 *   variables: {
 *      folder: // value for 'folder'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useMySavedRecipesQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<MySavedRecipesQuery, MySavedRecipesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<MySavedRecipesQuery, MySavedRecipesQueryVariables>(MySavedRecipesDocument, options);
      }
export function useMySavedRecipesLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<MySavedRecipesQuery, MySavedRecipesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<MySavedRecipesQuery, MySavedRecipesQueryVariables>(MySavedRecipesDocument, options);
        }
// @ts-ignore
export function useMySavedRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<MySavedRecipesQuery, MySavedRecipesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<MySavedRecipesQuery, MySavedRecipesQueryVariables>;
export function useMySavedRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<MySavedRecipesQuery, MySavedRecipesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<MySavedRecipesQuery | undefined, MySavedRecipesQueryVariables>;
export function useMySavedRecipesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<MySavedRecipesQuery, MySavedRecipesQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<MySavedRecipesQuery, MySavedRecipesQueryVariables>(MySavedRecipesDocument, options);
        }
export type MySavedRecipesQueryHookResult = ReturnType<typeof useMySavedRecipesQuery>;
export type MySavedRecipesLazyQueryHookResult = ReturnType<typeof useMySavedRecipesLazyQuery>;
export type MySavedRecipesSuspenseQueryHookResult = ReturnType<typeof useMySavedRecipesSuspenseQuery>;
export type MySavedRecipesQueryResult = ApolloReactCommon.QueryResult<MySavedRecipesQuery, MySavedRecipesQueryVariables>;
export const SavedRecipeFoldersDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SavedRecipeFolders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"savedRecipeFolders"}}]}}]} as unknown as DocumentNode;

/**
 * __useSavedRecipeFoldersQuery__
 *
 * To run a query within a React component, call `useSavedRecipeFoldersQuery` and pass it any options that fit your needs.
 * When your component renders, `useSavedRecipeFoldersQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSavedRecipeFoldersQuery({
 *   variables: {
 *   },
 * });
 */
export function useSavedRecipeFoldersQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>(SavedRecipeFoldersDocument, options);
      }
export function useSavedRecipeFoldersLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>(SavedRecipeFoldersDocument, options);
        }
// @ts-ignore
export function useSavedRecipeFoldersSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>;
export function useSavedRecipeFoldersSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SavedRecipeFoldersQuery | undefined, SavedRecipeFoldersQueryVariables>;
export function useSavedRecipeFoldersSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>(SavedRecipeFoldersDocument, options);
        }
export type SavedRecipeFoldersQueryHookResult = ReturnType<typeof useSavedRecipeFoldersQuery>;
export type SavedRecipeFoldersLazyQueryHookResult = ReturnType<typeof useSavedRecipeFoldersLazyQuery>;
export type SavedRecipeFoldersSuspenseQueryHookResult = ReturnType<typeof useSavedRecipeFoldersSuspenseQuery>;
export type SavedRecipeFoldersQueryResult = ApolloReactCommon.QueryResult<SavedRecipeFoldersQuery, SavedRecipeFoldersQueryVariables>;
export const CreateRecipeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRecipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateRecipeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRecipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicRecipeFragment"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"prepTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"cookTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"cuisine"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalSource"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"primarySource"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesPerServing"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"savedDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateRecipeMutation__
 *
 * To run a mutation, you first call `useCreateRecipeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateRecipeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createRecipeMutation, { data, loading, error }] = useCreateRecipeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateRecipeMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateRecipeMutation, CreateRecipeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateRecipeMutation, CreateRecipeMutationVariables>(CreateRecipeDocument, options);
      }
export type CreateRecipeMutationHookResult = ReturnType<typeof useCreateRecipeMutation>;
export type CreateRecipeMutationResult = ApolloReactCommon.MutationResult<CreateRecipeMutation>;
export type CreateRecipeMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateRecipeMutation, CreateRecipeMutationVariables>;
export const UpsertExternalRecipeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpsertExternalRecipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateRecipeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upsertExternalRecipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"externalSource"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"prepTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"cookTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}}]}},{"kind":"Field","name":{"kind":"Name","value":"created"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useUpsertExternalRecipeMutation__
 *
 * To run a mutation, you first call `useUpsertExternalRecipeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpsertExternalRecipeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [upsertExternalRecipeMutation, { data, loading, error }] = useUpsertExternalRecipeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpsertExternalRecipeMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UpsertExternalRecipeMutation, UpsertExternalRecipeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UpsertExternalRecipeMutation, UpsertExternalRecipeMutationVariables>(UpsertExternalRecipeDocument, options);
      }
export type UpsertExternalRecipeMutationHookResult = ReturnType<typeof useUpsertExternalRecipeMutation>;
export type UpsertExternalRecipeMutationResult = ApolloReactCommon.MutationResult<UpsertExternalRecipeMutation>;
export type UpsertExternalRecipeMutationOptions = ApolloReactCommon.BaseMutationOptions<UpsertExternalRecipeMutation, UpsertExternalRecipeMutationVariables>;
export const UpdateRecipeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRecipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateRecipeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRecipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RecipeFragment"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"prepTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"cookTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"cuisine"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalSource"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"primarySource"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesPerServing"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"savedDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicRecipeFragment"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"videoUrl"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUrl"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"averageRating"}},{"kind":"Field","name":{"kind":"Name","value":"totalReviews"}},{"kind":"Field","name":{"kind":"Name","value":"rating1Count"}},{"kind":"Field","name":{"kind":"Name","value":"rating2Count"}},{"kind":"Field","name":{"kind":"Name","value":"rating3Count"}},{"kind":"Field","name":{"kind":"Name","value":"rating4Count"}},{"kind":"Field","name":{"kind":"Name","value":"rating5Count"}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicUser"}}]}},{"kind":"Field","name":{"kind":"Name","value":"ingredients"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RecipeIngredientFragment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicUser"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RecipeIngredientFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecipeIngredient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"item"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"isOptional"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"preparation"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"section"}}]}}]} as unknown as DocumentNode;

/**
 * __useUpdateRecipeMutation__
 *
 * To run a mutation, you first call `useUpdateRecipeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateRecipeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateRecipeMutation, { data, loading, error }] = useUpdateRecipeMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateRecipeMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UpdateRecipeMutation, UpdateRecipeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UpdateRecipeMutation, UpdateRecipeMutationVariables>(UpdateRecipeDocument, options);
      }
export type UpdateRecipeMutationHookResult = ReturnType<typeof useUpdateRecipeMutation>;
export type UpdateRecipeMutationResult = ApolloReactCommon.MutationResult<UpdateRecipeMutation>;
export type UpdateRecipeMutationOptions = ApolloReactCommon.BaseMutationOptions<UpdateRecipeMutation, UpdateRecipeMutationVariables>;
export const UpdateRecipeIngredientsDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRecipeIngredients"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recipeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ingredients"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RecipeIngredientInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRecipeIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"recipeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recipeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"ingredients"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ingredients"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"ingredients"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RecipeIngredientFragment"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RecipeIngredientFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecipeIngredient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"item"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"isOptional"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"preparation"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"section"}}]}}]} as unknown as DocumentNode;

/**
 * __useUpdateRecipeIngredientsMutation__
 *
 * To run a mutation, you first call `useUpdateRecipeIngredientsMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateRecipeIngredientsMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateRecipeIngredientsMutation, { data, loading, error }] = useUpdateRecipeIngredientsMutation({
 *   variables: {
 *      recipeId: // value for 'recipeId'
 *      ingredients: // value for 'ingredients'
 *   },
 * });
 */
export function useUpdateRecipeIngredientsMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UpdateRecipeIngredientsMutation, UpdateRecipeIngredientsMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UpdateRecipeIngredientsMutation, UpdateRecipeIngredientsMutationVariables>(UpdateRecipeIngredientsDocument, options);
      }
export type UpdateRecipeIngredientsMutationHookResult = ReturnType<typeof useUpdateRecipeIngredientsMutation>;
export type UpdateRecipeIngredientsMutationResult = ApolloReactCommon.MutationResult<UpdateRecipeIngredientsMutation>;
export type UpdateRecipeIngredientsMutationOptions = ApolloReactCommon.BaseMutationOptions<UpdateRecipeIngredientsMutation, UpdateRecipeIngredientsMutationVariables>;
export const DeleteRecipeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteRecipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteRecipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useDeleteRecipeMutation__
 *
 * To run a mutation, you first call `useDeleteRecipeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteRecipeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteRecipeMutation, { data, loading, error }] = useDeleteRecipeMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteRecipeMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DeleteRecipeMutation, DeleteRecipeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DeleteRecipeMutation, DeleteRecipeMutationVariables>(DeleteRecipeDocument, options);
      }
export type DeleteRecipeMutationHookResult = ReturnType<typeof useDeleteRecipeMutation>;
export type DeleteRecipeMutationResult = ApolloReactCommon.MutationResult<DeleteRecipeMutation>;
export type DeleteRecipeMutationOptions = ApolloReactCommon.BaseMutationOptions<DeleteRecipeMutation, DeleteRecipeMutationVariables>;
export const FavoriteRecipeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FavoriteRecipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"FavoriteRecipeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"favoriteRecipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"savedRecipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"recipeId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastCookedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"BasicRecipeFragment"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"BasicRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"prepTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"cookTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"cuisine"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isExternal"}},{"kind":"Field","name":{"kind":"Name","value":"externalSource"}},{"kind":"Field","name":{"kind":"Name","value":"externalId"}},{"kind":"Field","name":{"kind":"Name","value":"primarySource"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesPerServing"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"savedDetails"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useFavoriteRecipeMutation__
 *
 * To run a mutation, you first call `useFavoriteRecipeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useFavoriteRecipeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [favoriteRecipeMutation, { data, loading, error }] = useFavoriteRecipeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useFavoriteRecipeMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<FavoriteRecipeMutation, FavoriteRecipeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<FavoriteRecipeMutation, FavoriteRecipeMutationVariables>(FavoriteRecipeDocument, options);
      }
export type FavoriteRecipeMutationHookResult = ReturnType<typeof useFavoriteRecipeMutation>;
export type FavoriteRecipeMutationResult = ApolloReactCommon.MutationResult<FavoriteRecipeMutation>;
export type FavoriteRecipeMutationOptions = ApolloReactCommon.BaseMutationOptions<FavoriteRecipeMutation, FavoriteRecipeMutationVariables>;
export const UnfavoriteRecipeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UnfavoriteRecipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recipeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unfavoriteRecipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"recipeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recipeId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"savedRecipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useUnfavoriteRecipeMutation__
 *
 * To run a mutation, you first call `useUnfavoriteRecipeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUnfavoriteRecipeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [unfavoriteRecipeMutation, { data, loading, error }] = useUnfavoriteRecipeMutation({
 *   variables: {
 *      recipeId: // value for 'recipeId'
 *   },
 * });
 */
export function useUnfavoriteRecipeMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UnfavoriteRecipeMutation, UnfavoriteRecipeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UnfavoriteRecipeMutation, UnfavoriteRecipeMutationVariables>(UnfavoriteRecipeDocument, options);
      }
export type UnfavoriteRecipeMutationHookResult = ReturnType<typeof useUnfavoriteRecipeMutation>;
export type UnfavoriteRecipeMutationResult = ApolloReactCommon.MutationResult<UnfavoriteRecipeMutation>;
export type UnfavoriteRecipeMutationOptions = ApolloReactCommon.BaseMutationOptions<UnfavoriteRecipeMutation, UnfavoriteRecipeMutationVariables>;
export const DeleteRecipeFolderDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteRecipeFolder"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteRecipeFolderInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteRecipeFolder"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useDeleteRecipeFolderMutation__
 *
 * To run a mutation, you first call `useDeleteRecipeFolderMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteRecipeFolderMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteRecipeFolderMutation, { data, loading, error }] = useDeleteRecipeFolderMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useDeleteRecipeFolderMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DeleteRecipeFolderMutation, DeleteRecipeFolderMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DeleteRecipeFolderMutation, DeleteRecipeFolderMutationVariables>(DeleteRecipeFolderDocument, options);
      }
export type DeleteRecipeFolderMutationHookResult = ReturnType<typeof useDeleteRecipeFolderMutation>;
export type DeleteRecipeFolderMutationResult = ApolloReactCommon.MutationResult<DeleteRecipeFolderMutation>;
export type DeleteRecipeFolderMutationOptions = ApolloReactCommon.BaseMutationOptions<DeleteRecipeFolderMutation, DeleteRecipeFolderMutationVariables>;
export const UpdateFavoriteRecipeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateFavoriteRecipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recipeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateFavoriteRecipeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateFavoriteRecipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"recipeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recipeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"savedRecipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"recipeId"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"folder"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"personalRating"}},{"kind":"Field","name":{"kind":"Name","value":"cookedCount"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useUpdateFavoriteRecipeMutation__
 *
 * To run a mutation, you first call `useUpdateFavoriteRecipeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateFavoriteRecipeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateFavoriteRecipeMutation, { data, loading, error }] = useUpdateFavoriteRecipeMutation({
 *   variables: {
 *      recipeId: // value for 'recipeId'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateFavoriteRecipeMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UpdateFavoriteRecipeMutation, UpdateFavoriteRecipeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UpdateFavoriteRecipeMutation, UpdateFavoriteRecipeMutationVariables>(UpdateFavoriteRecipeDocument, options);
      }
export type UpdateFavoriteRecipeMutationHookResult = ReturnType<typeof useUpdateFavoriteRecipeMutation>;
export type UpdateFavoriteRecipeMutationResult = ApolloReactCommon.MutationResult<UpdateFavoriteRecipeMutation>;
export type UpdateFavoriteRecipeMutationOptions = ApolloReactCommon.BaseMutationOptions<UpdateFavoriteRecipeMutation, UpdateFavoriteRecipeMutationVariables>;
export const CreateShoppingListItemsFromRecipeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateShoppingListItemsFromRecipe"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateShoppingListItemsFromRecipeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createShoppingListItemsFromRecipe"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addedItems"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"itemName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"storeInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aisle"}}]}},{"kind":"Field","name":{"kind":"Name","value":"purchaseInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isPurchased"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"updatedItems"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"itemName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"purchaseInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isPurchased"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"skippedItems"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalAdded"}},{"kind":"Field","name":{"kind":"Name","value":"totalUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"totalSkipped"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateShoppingListItemsFromRecipeMutation__
 *
 * To run a mutation, you first call `useCreateShoppingListItemsFromRecipeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateShoppingListItemsFromRecipeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createShoppingListItemsFromRecipeMutation, { data, loading, error }] = useCreateShoppingListItemsFromRecipeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateShoppingListItemsFromRecipeMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateShoppingListItemsFromRecipeMutation, CreateShoppingListItemsFromRecipeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateShoppingListItemsFromRecipeMutation, CreateShoppingListItemsFromRecipeMutationVariables>(CreateShoppingListItemsFromRecipeDocument, options);
      }
export type CreateShoppingListItemsFromRecipeMutationHookResult = ReturnType<typeof useCreateShoppingListItemsFromRecipeMutation>;
export type CreateShoppingListItemsFromRecipeMutationResult = ApolloReactCommon.MutationResult<CreateShoppingListItemsFromRecipeMutation>;
export type CreateShoppingListItemsFromRecipeMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateShoppingListItemsFromRecipeMutation, CreateShoppingListItemsFromRecipeMutationVariables>;
export const CreateShoppingListItemFromRecipeIngredientDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateShoppingListItemFromRecipeIngredient"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recipeIngredientId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shoppingListId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"quantityOverride"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createShoppingListItemFromRecipeIngredient"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"recipeIngredientId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recipeIngredientId"}}},{"kind":"Argument","name":{"kind":"Name","value":"shoppingListId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shoppingListId"}}},{"kind":"Argument","name":{"kind":"Name","value":"quantityOverride"},"value":{"kind":"Variable","name":{"kind":"Name","value":"quantityOverride"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"shoppingListItem"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"itemName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"previousQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"quantityAdded"}},{"kind":"Field","name":{"kind":"Name","value":"wasUpdated"}},{"kind":"Field","name":{"kind":"Name","value":"unitConversionApplied"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateShoppingListItemFromRecipeIngredientMutation__
 *
 * To run a mutation, you first call `useCreateShoppingListItemFromRecipeIngredientMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateShoppingListItemFromRecipeIngredientMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createShoppingListItemFromRecipeIngredientMutation, { data, loading, error }] = useCreateShoppingListItemFromRecipeIngredientMutation({
 *   variables: {
 *      recipeIngredientId: // value for 'recipeIngredientId'
 *      shoppingListId: // value for 'shoppingListId'
 *      quantityOverride: // value for 'quantityOverride'
 *   },
 * });
 */
export function useCreateShoppingListItemFromRecipeIngredientMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateShoppingListItemFromRecipeIngredientMutation, CreateShoppingListItemFromRecipeIngredientMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateShoppingListItemFromRecipeIngredientMutation, CreateShoppingListItemFromRecipeIngredientMutationVariables>(CreateShoppingListItemFromRecipeIngredientDocument, options);
      }
export type CreateShoppingListItemFromRecipeIngredientMutationHookResult = ReturnType<typeof useCreateShoppingListItemFromRecipeIngredientMutation>;
export type CreateShoppingListItemFromRecipeIngredientMutationResult = ApolloReactCommon.MutationResult<CreateShoppingListItemFromRecipeIngredientMutation>;
export type CreateShoppingListItemFromRecipeIngredientMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateShoppingListItemFromRecipeIngredientMutation, CreateShoppingListItemFromRecipeIngredientMutationVariables>;
export const MatchRecipeIngredientsToPantryDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MatchRecipeIngredientsToPantry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pantryId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recipeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"servings"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"matchRecipeIngredientsToPantry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pantryId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pantryId"}}},{"kind":"Argument","name":{"kind":"Name","value":"recipeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recipeId"}}},{"kind":"Argument","name":{"kind":"Name","value":"servings"},"value":{"kind":"Variable","name":{"kind":"Name","value":"servings"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ingredient"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RecipeIngredientFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isAvailable"}},{"kind":"Field","name":{"kind":"Name","value":"matchConfidence"}},{"kind":"Field","name":{"kind":"Name","value":"availableQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"suggestedQuantity"}},{"kind":"Field","name":{"kind":"Name","value":"shortfall"}},{"kind":"Field","name":{"kind":"Name","value":"suggestedUnit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"matchedPantryItem"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"itemName"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RecipeIngredientFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecipeIngredient"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"quantity"}},{"kind":"Field","name":{"kind":"Name","value":"item"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}}]}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"image"}},{"kind":"Field","name":{"kind":"Name","value":"isOptional"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"preparation"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"section"}}]}}]} as unknown as DocumentNode;

/**
 * __useMatchRecipeIngredientsToPantryQuery__
 *
 * To run a query within a React component, call `useMatchRecipeIngredientsToPantryQuery` and pass it any options that fit your needs.
 * When your component renders, `useMatchRecipeIngredientsToPantryQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMatchRecipeIngredientsToPantryQuery({
 *   variables: {
 *      pantryId: // value for 'pantryId'
 *      recipeId: // value for 'recipeId'
 *      servings: // value for 'servings'
 *   },
 * });
 */
export function useMatchRecipeIngredientsToPantryQuery(baseOptions: ApolloReactHooks.QueryHookOptions<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables> & ({ variables: MatchRecipeIngredientsToPantryQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables>(MatchRecipeIngredientsToPantryDocument, options);
      }
export function useMatchRecipeIngredientsToPantryLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables>(MatchRecipeIngredientsToPantryDocument, options);
        }
// @ts-ignore
export function useMatchRecipeIngredientsToPantrySuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables>;
export function useMatchRecipeIngredientsToPantrySuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<MatchRecipeIngredientsToPantryQuery | undefined, MatchRecipeIngredientsToPantryQueryVariables>;
export function useMatchRecipeIngredientsToPantrySuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables>(MatchRecipeIngredientsToPantryDocument, options);
        }
export type MatchRecipeIngredientsToPantryQueryHookResult = ReturnType<typeof useMatchRecipeIngredientsToPantryQuery>;
export type MatchRecipeIngredientsToPantryLazyQueryHookResult = ReturnType<typeof useMatchRecipeIngredientsToPantryLazyQuery>;
export type MatchRecipeIngredientsToPantrySuspenseQueryHookResult = ReturnType<typeof useMatchRecipeIngredientsToPantrySuspenseQuery>;
export type MatchRecipeIngredientsToPantryQueryResult = ApolloReactCommon.QueryResult<MatchRecipeIngredientsToPantryQuery, MatchRecipeIngredientsToPantryQueryVariables>;
export const ConfirmRecipeConsumptionDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmRecipeConsumption"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ConfirmRecipeConsumptionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmRecipeConsumption"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"totalConsumed"}},{"kind":"Field","name":{"kind":"Name","value":"totalFailed"}},{"kind":"Field","name":{"kind":"Name","value":"cookingLog"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"servingsMade"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"cookedAt"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useConfirmRecipeConsumptionMutation__
 *
 * To run a mutation, you first call `useConfirmRecipeConsumptionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useConfirmRecipeConsumptionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [confirmRecipeConsumptionMutation, { data, loading, error }] = useConfirmRecipeConsumptionMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useConfirmRecipeConsumptionMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<ConfirmRecipeConsumptionMutation, ConfirmRecipeConsumptionMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<ConfirmRecipeConsumptionMutation, ConfirmRecipeConsumptionMutationVariables>(ConfirmRecipeConsumptionDocument, options);
      }
export type ConfirmRecipeConsumptionMutationHookResult = ReturnType<typeof useConfirmRecipeConsumptionMutation>;
export type ConfirmRecipeConsumptionMutationResult = ApolloReactCommon.MutationResult<ConfirmRecipeConsumptionMutation>;
export type ConfirmRecipeConsumptionMutationOptions = ApolloReactCommon.BaseMutationOptions<ConfirmRecipeConsumptionMutation, ConfirmRecipeConsumptionMutationVariables>;
export const MarkRecipeAsCookedDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkRecipeAsCooked"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"MarkRecipeAsCookedInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markRecipeAsCooked"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"cookingLog"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"servingsMade"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"cookedAt"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useMarkRecipeAsCookedMutation__
 *
 * To run a mutation, you first call `useMarkRecipeAsCookedMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useMarkRecipeAsCookedMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [markRecipeAsCookedMutation, { data, loading, error }] = useMarkRecipeAsCookedMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useMarkRecipeAsCookedMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<MarkRecipeAsCookedMutation, MarkRecipeAsCookedMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<MarkRecipeAsCookedMutation, MarkRecipeAsCookedMutationVariables>(MarkRecipeAsCookedDocument, options);
      }
export type MarkRecipeAsCookedMutationHookResult = ReturnType<typeof useMarkRecipeAsCookedMutation>;
export type MarkRecipeAsCookedMutationResult = ApolloReactCommon.MutationResult<MarkRecipeAsCookedMutation>;
export type MarkRecipeAsCookedMutationOptions = ApolloReactCommon.BaseMutationOptions<MarkRecipeAsCookedMutation, MarkRecipeAsCookedMutationVariables>;