// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type ItemByUpcFilterQueryVariables = Types.Exact<{
  upc: Types.Scalars['String']['input'];
  upcFormat?: Types.InputMaybe<Types.UpcFormat>;
}>;


export type ItemByUpcFilterQuery = { __typename: 'Query', items: { __typename: 'ItemConnection', totalCount: number | null, edges: Array<{ __typename: 'ItemEdge', cursor: string, node: { __typename: 'Item', id: string, imageUrl: string | null, name: string, description: string | null, netWeight: number | null, primaryUpc: string | null, type: Types.ItemType, storageState: Types.StorageState, shelfLifeDays: number | null, shelfLifeOpenedDays: number | null, tags: Array<string>, displayUnit: { __typename: 'Unit', id: string, name: string, symbol: string } | null, brands: Array<{ __typename: 'ItemBrand', brand: { __typename: 'Brand', id: string, name: string } }>, categories: Array<{ __typename: 'ItemCategory', isPrimary: boolean, category: { __typename: 'Category', id: string, name: string, type: Types.CategoryType } }>, units: Array<{ __typename: 'ItemUnit', isDefault: boolean, unitId: string }>, variationBrand: { __typename: 'Brand', id: string, name: string } | null, matchedVariation: { __typename: 'ProductVariation', netWeight: number | null, netWeightUnit: string | null, packageSize: string | null, confidence: number | null, brandInfo: { __typename: 'VariationBrandInfo', id: string | null, name: string } | null } | null } }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type ItemBySkuFilterQueryVariables = Types.Exact<{
  sku: Types.Scalars['String']['input'];
  skuStoreId?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type ItemBySkuFilterQuery = { __typename: 'Query', items: { __typename: 'ItemConnection', totalCount: number | null, edges: Array<{ __typename: 'ItemEdge', cursor: string, node: { __typename: 'Item', id: string, imageUrl: string | null, name: string, description: string | null, netWeight: number | null, primaryUpc: string | null, type: Types.ItemType, storageState: Types.StorageState, shelfLifeDays: number | null, shelfLifeOpenedDays: number | null, tags: Array<string>, displayUnit: { __typename: 'Unit', id: string, name: string, symbol: string } | null, brands: Array<{ __typename: 'ItemBrand', brand: { __typename: 'Brand', id: string, name: string } }>, categories: Array<{ __typename: 'ItemCategory', isPrimary: boolean, category: { __typename: 'Category', id: string, name: string, type: Types.CategoryType } }>, units: Array<{ __typename: 'ItemUnit', isDefault: boolean, unitId: string }> } }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type GetOnboardingItemsQueryVariables = Types.Exact<{
  filters?: Types.InputMaybe<Types.ItemFilters>;
  sort?: Types.InputMaybe<Types.ItemSortInput>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type GetOnboardingItemsQuery = { __typename: 'Query', items: { __typename: 'ItemConnection', totalCount: number | null, edges: Array<{ __typename: 'ItemEdge', cursor: string, node: { __typename: 'Item', id: string, name: string, imageUrl: string | null, storageState: Types.StorageState, displayUnit: { __typename: 'Unit', id: string, name: string } | null } }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type AutocompleteItemsQueryVariables = Types.Exact<{
  input: Types.AutocompleteInput;
}>;


export type AutocompleteItemsQuery = { __typename: 'Query', autocompleteItems: { __typename: 'AutocompleteResponse', totalCount: number, suggestions: Array<{ __typename: 'ItemSuggestion', id: string, name: string, type: Types.ItemType, imageUrl: string | null, netWeight: number | null, displayUnit: string | null, defaultUnit: { __typename: 'ItemUnitSuggestion', id: string, name: string, symbol: string, type: Types.UnitType, isDefault: boolean, isPreferred: boolean } | null, brands: Array<{ __typename: 'BrandSuggestion', id: string, name: string }>, category: { __typename: 'ItemCategorySuggestion', id: string, name: string, type: Types.CategoryType, isPrimary: boolean } | null }> } };

export type SearchBrandsQueryVariables = Types.Exact<{
  search: Types.Scalars['String']['input'];
  limit?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type SearchBrandsQuery = { __typename: 'Query', brands: { __typename: 'BrandConnection', totalCount: number | null, edges: Array<{ __typename: 'BrandEdge', node: { __typename: 'Brand', id: string, name: string } }> } };

export type AutocompleteCategoriesQueryVariables = Types.Exact<{
  input: Types.AutocompleteCategoryInput;
}>;


export type AutocompleteCategoriesQuery = { __typename: 'Query', autocompleteCategories: { __typename: 'AutocompleteCategoryResponse', totalCount: number, suggestions: Array<{ __typename: 'CategorySuggestion', id: string, name: string, type: Types.CategoryType, icon: string | null }> } };

export type GetPopularItemsQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetPopularItemsQuery = { __typename: 'Query', items: { __typename: 'ItemConnection', totalCount: number | null, edges: Array<{ __typename: 'ItemEdge', node: { __typename: 'Item', id: string, name: string, imageUrl: string | null, popularity: number, displayUnit: { __typename: 'Unit', id: string, name: string, symbol: string, type: Types.UnitType } | null, brands: Array<{ __typename: 'ItemBrand', brand: { __typename: 'Brand', id: string, name: string } }>, categories: Array<{ __typename: 'ItemCategory', isPrimary: boolean, category: { __typename: 'Category', id: string, name: string, type: Types.CategoryType } }> } }> } };

export type CreateItemMutationVariables = Types.Exact<{
  input: Types.CreateItemInput;
}>;


export type CreateItemMutation = { __typename: 'Mutation', createItem: { __typename: 'ItemPayload', success: boolean, message: string, code: string, item: { __typename: 'Item', id: string, name: string, description: string | null, netWeight: number | null, type: Types.ItemType, storageState: Types.StorageState, shelfLifeDays: number | null, shelfLifeOpenedDays: number | null, imageUrl: string | null, tags: Array<string>, displayUnit: { __typename: 'Unit', id: string, name: string, symbol: string } | null, convertedNetWeight: { __typename: 'ConvertedValue', value: number, unit: { __typename: 'Unit', id: string, name: string, symbol: string } } | null, brands: Array<{ __typename: 'ItemBrand', brand: { __typename: 'Brand', id: string, name: string } }>, categories: Array<{ __typename: 'ItemCategory', category: { __typename: 'Category', id: string, name: string } }>, units: Array<{ __typename: 'ItemUnit', id: string, unitId: string, isDefault: boolean, packageSize: number | null, retailUnit: boolean, contentUnitId: string | null, unit: { __typename: 'Unit', id: string, name: string, symbol: string } | null, contentUnit: { __typename: 'Unit', id: string, name: string, symbol: string } | null }> } | null } };

export type FlagItemForReviewMutationVariables = Types.Exact<{
  itemId: Types.Scalars['ID']['input'];
  reason?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type FlagItemForReviewMutation = { __typename: 'Mutation', flagItemForReview: { __typename: 'ItemPayload', success: boolean, message: string, code: string, item: { __typename: 'Item', id: string } | null } };


export const ItemByUpcFilterDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ItemByUpcFilter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"upc"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"upcFormat"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"UpcFormat"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lookup"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"upc"},"value":{"kind":"Variable","name":{"kind":"Name","value":"upc"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"upcFormat"},"value":{"kind":"Variable","name":{"kind":"Name","value":"upcFormat"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"netWeight"}},{"kind":"Field","name":{"kind":"Name","value":"primaryUpc"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"storageState"}},{"kind":"Field","name":{"kind":"Name","value":"shelfLifeDays"}},{"kind":"Field","name":{"kind":"Name","value":"shelfLifeOpenedDays"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"displayUnit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"brands"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"brand"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"category"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"units"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isDefault"}},{"kind":"Field","name":{"kind":"Name","value":"unitId"}}]}},{"kind":"Field","name":{"kind":"Name","value":"variationBrand"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"matchedVariation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"netWeight"}},{"kind":"Field","name":{"kind":"Name","value":"netWeightUnit"}},{"kind":"Field","name":{"kind":"Name","value":"packageSize"}},{"kind":"Field","name":{"kind":"Name","value":"confidence"}},{"kind":"Field","name":{"kind":"Name","value":"brandInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useItemByUpcFilterQuery__
 *
 * To run a query within a React component, call `useItemByUpcFilterQuery` and pass it any options that fit your needs.
 * When your component renders, `useItemByUpcFilterQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useItemByUpcFilterQuery({
 *   variables: {
 *      upc: // value for 'upc'
 *      upcFormat: // value for 'upcFormat'
 *   },
 * });
 */
export function useItemByUpcFilterQuery(baseOptions: ApolloReactHooks.QueryHookOptions<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables> & ({ variables: ItemByUpcFilterQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables>(ItemByUpcFilterDocument, options);
      }
export function useItemByUpcFilterLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables>(ItemByUpcFilterDocument, options);
        }
// @ts-ignore
export function useItemByUpcFilterSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables>;
export function useItemByUpcFilterSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<ItemByUpcFilterQuery | undefined, ItemByUpcFilterQueryVariables>;
export function useItemByUpcFilterSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables>(ItemByUpcFilterDocument, options);
        }
export type ItemByUpcFilterQueryHookResult = ReturnType<typeof useItemByUpcFilterQuery>;
export type ItemByUpcFilterLazyQueryHookResult = ReturnType<typeof useItemByUpcFilterLazyQuery>;
export type ItemByUpcFilterSuspenseQueryHookResult = ReturnType<typeof useItemByUpcFilterSuspenseQuery>;
export type ItemByUpcFilterQueryResult = ApolloReactCommon.QueryResult<ItemByUpcFilterQuery, ItemByUpcFilterQueryVariables>;
export const ItemBySkuFilterDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ItemBySkuFilter"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sku"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"skuStoreId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"lookup"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"sku"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sku"}}},{"kind":"ObjectField","name":{"kind":"Name","value":"skuStoreId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"skuStoreId"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"netWeight"}},{"kind":"Field","name":{"kind":"Name","value":"primaryUpc"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"storageState"}},{"kind":"Field","name":{"kind":"Name","value":"shelfLifeDays"}},{"kind":"Field","name":{"kind":"Name","value":"shelfLifeOpenedDays"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"displayUnit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"brands"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"brand"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"category"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"units"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isDefault"}},{"kind":"Field","name":{"kind":"Name","value":"unitId"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useItemBySkuFilterQuery__
 *
 * To run a query within a React component, call `useItemBySkuFilterQuery` and pass it any options that fit your needs.
 * When your component renders, `useItemBySkuFilterQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useItemBySkuFilterQuery({
 *   variables: {
 *      sku: // value for 'sku'
 *      skuStoreId: // value for 'skuStoreId'
 *   },
 * });
 */
export function useItemBySkuFilterQuery(baseOptions: ApolloReactHooks.QueryHookOptions<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables> & ({ variables: ItemBySkuFilterQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables>(ItemBySkuFilterDocument, options);
      }
export function useItemBySkuFilterLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables>(ItemBySkuFilterDocument, options);
        }
// @ts-ignore
export function useItemBySkuFilterSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables>;
export function useItemBySkuFilterSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<ItemBySkuFilterQuery | undefined, ItemBySkuFilterQueryVariables>;
export function useItemBySkuFilterSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables>(ItemBySkuFilterDocument, options);
        }
export type ItemBySkuFilterQueryHookResult = ReturnType<typeof useItemBySkuFilterQuery>;
export type ItemBySkuFilterLazyQueryHookResult = ReturnType<typeof useItemBySkuFilterLazyQuery>;
export type ItemBySkuFilterSuspenseQueryHookResult = ReturnType<typeof useItemBySkuFilterSuspenseQuery>;
export type ItemBySkuFilterQueryResult = ApolloReactCommon.QueryResult<ItemBySkuFilterQuery, ItemBySkuFilterQueryVariables>;
export const GetOnboardingItemsDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetOnboardingItems"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filters"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ItemFilters"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sort"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ItemSortInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sort"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"storageState"}},{"kind":"Field","name":{"kind":"Name","value":"displayUnit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useGetOnboardingItemsQuery__
 *
 * To run a query within a React component, call `useGetOnboardingItemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetOnboardingItemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetOnboardingItemsQuery({
 *   variables: {
 *      filters: // value for 'filters'
 *      sort: // value for 'sort'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetOnboardingItemsQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>(GetOnboardingItemsDocument, options);
      }
export function useGetOnboardingItemsLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>(GetOnboardingItemsDocument, options);
        }
// @ts-ignore
export function useGetOnboardingItemsSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>;
export function useGetOnboardingItemsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetOnboardingItemsQuery | undefined, GetOnboardingItemsQueryVariables>;
export function useGetOnboardingItemsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>(GetOnboardingItemsDocument, options);
        }
export type GetOnboardingItemsQueryHookResult = ReturnType<typeof useGetOnboardingItemsQuery>;
export type GetOnboardingItemsLazyQueryHookResult = ReturnType<typeof useGetOnboardingItemsLazyQuery>;
export type GetOnboardingItemsSuspenseQueryHookResult = ReturnType<typeof useGetOnboardingItemsSuspenseQuery>;
export type GetOnboardingItemsQueryResult = ApolloReactCommon.QueryResult<GetOnboardingItemsQuery, GetOnboardingItemsQueryVariables>;
export const AutocompleteItemsDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AutocompleteItems"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AutocompleteInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"autocompleteItems"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"suggestions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"netWeight"}},{"kind":"Field","name":{"kind":"Name","value":"displayUnit"}},{"kind":"Field","name":{"kind":"Name","value":"defaultUnit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}},{"kind":"Field","name":{"kind":"Name","value":"isPreferred"}}]}},{"kind":"Field","name":{"kind":"Name","value":"brands"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"category"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useAutocompleteItemsQuery__
 *
 * To run a query within a React component, call `useAutocompleteItemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useAutocompleteItemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAutocompleteItemsQuery({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAutocompleteItemsQuery(baseOptions: ApolloReactHooks.QueryHookOptions<AutocompleteItemsQuery, AutocompleteItemsQueryVariables> & ({ variables: AutocompleteItemsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>(AutocompleteItemsDocument, options);
      }
export function useAutocompleteItemsLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>(AutocompleteItemsDocument, options);
        }
// @ts-ignore
export function useAutocompleteItemsSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>;
export function useAutocompleteItemsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<AutocompleteItemsQuery | undefined, AutocompleteItemsQueryVariables>;
export function useAutocompleteItemsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>(AutocompleteItemsDocument, options);
        }
export type AutocompleteItemsQueryHookResult = ReturnType<typeof useAutocompleteItemsQuery>;
export type AutocompleteItemsLazyQueryHookResult = ReturnType<typeof useAutocompleteItemsLazyQuery>;
export type AutocompleteItemsSuspenseQueryHookResult = ReturnType<typeof useAutocompleteItemsSuspenseQuery>;
export type AutocompleteItemsQueryResult = ApolloReactCommon.QueryResult<AutocompleteItemsQuery, AutocompleteItemsQueryVariables>;
export const SearchBrandsDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchBrands"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"brands"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useSearchBrandsQuery__
 *
 * To run a query within a React component, call `useSearchBrandsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchBrandsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchBrandsQuery({
 *   variables: {
 *      search: // value for 'search'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchBrandsQuery(baseOptions: ApolloReactHooks.QueryHookOptions<SearchBrandsQuery, SearchBrandsQueryVariables> & ({ variables: SearchBrandsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<SearchBrandsQuery, SearchBrandsQueryVariables>(SearchBrandsDocument, options);
      }
export function useSearchBrandsLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<SearchBrandsQuery, SearchBrandsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<SearchBrandsQuery, SearchBrandsQueryVariables>(SearchBrandsDocument, options);
        }
// @ts-ignore
export function useSearchBrandsSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<SearchBrandsQuery, SearchBrandsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SearchBrandsQuery, SearchBrandsQueryVariables>;
export function useSearchBrandsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SearchBrandsQuery, SearchBrandsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SearchBrandsQuery | undefined, SearchBrandsQueryVariables>;
export function useSearchBrandsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SearchBrandsQuery, SearchBrandsQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<SearchBrandsQuery, SearchBrandsQueryVariables>(SearchBrandsDocument, options);
        }
export type SearchBrandsQueryHookResult = ReturnType<typeof useSearchBrandsQuery>;
export type SearchBrandsLazyQueryHookResult = ReturnType<typeof useSearchBrandsLazyQuery>;
export type SearchBrandsSuspenseQueryHookResult = ReturnType<typeof useSearchBrandsSuspenseQuery>;
export type SearchBrandsQueryResult = ApolloReactCommon.QueryResult<SearchBrandsQuery, SearchBrandsQueryVariables>;
export const AutocompleteCategoriesDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AutocompleteCategories"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AutocompleteCategoryInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"autocompleteCategories"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"suggestions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useAutocompleteCategoriesQuery__
 *
 * To run a query within a React component, call `useAutocompleteCategoriesQuery` and pass it any options that fit your needs.
 * When your component renders, `useAutocompleteCategoriesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useAutocompleteCategoriesQuery({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAutocompleteCategoriesQuery(baseOptions: ApolloReactHooks.QueryHookOptions<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables> & ({ variables: AutocompleteCategoriesQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables>(AutocompleteCategoriesDocument, options);
      }
export function useAutocompleteCategoriesLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables>(AutocompleteCategoriesDocument, options);
        }
// @ts-ignore
export function useAutocompleteCategoriesSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables>;
export function useAutocompleteCategoriesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<AutocompleteCategoriesQuery | undefined, AutocompleteCategoriesQueryVariables>;
export function useAutocompleteCategoriesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables>(AutocompleteCategoriesDocument, options);
        }
export type AutocompleteCategoriesQueryHookResult = ReturnType<typeof useAutocompleteCategoriesQuery>;
export type AutocompleteCategoriesLazyQueryHookResult = ReturnType<typeof useAutocompleteCategoriesLazyQuery>;
export type AutocompleteCategoriesSuspenseQueryHookResult = ReturnType<typeof useAutocompleteCategoriesSuspenseQuery>;
export type AutocompleteCategoriesQueryResult = ApolloReactCommon.QueryResult<AutocompleteCategoriesQuery, AutocompleteCategoriesQueryVariables>;
export const GetPopularItemsDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPopularItems"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sort"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"field"},"value":{"kind":"EnumValue","value":"POPULARITY"}},{"kind":"ObjectField","name":{"kind":"Name","value":"order"},"value":{"kind":"EnumValue","value":"DESC"}}]}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"popularity"}},{"kind":"Field","name":{"kind":"Name","value":"displayUnit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}},{"kind":"Field","name":{"kind":"Name","value":"brands"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"brand"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isPrimary"}},{"kind":"Field","name":{"kind":"Name","value":"category"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useGetPopularItemsQuery__
 *
 * To run a query within a React component, call `useGetPopularItemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetPopularItemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetPopularItemsQuery({
 *   variables: {
 *      first: // value for 'first'
 *   },
 * });
 */
export function useGetPopularItemsQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<GetPopularItemsQuery, GetPopularItemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetPopularItemsQuery, GetPopularItemsQueryVariables>(GetPopularItemsDocument, options);
      }
export function useGetPopularItemsLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetPopularItemsQuery, GetPopularItemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetPopularItemsQuery, GetPopularItemsQueryVariables>(GetPopularItemsDocument, options);
        }
// @ts-ignore
export function useGetPopularItemsSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetPopularItemsQuery, GetPopularItemsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetPopularItemsQuery, GetPopularItemsQueryVariables>;
export function useGetPopularItemsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetPopularItemsQuery, GetPopularItemsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetPopularItemsQuery | undefined, GetPopularItemsQueryVariables>;
export function useGetPopularItemsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetPopularItemsQuery, GetPopularItemsQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetPopularItemsQuery, GetPopularItemsQueryVariables>(GetPopularItemsDocument, options);
        }
export type GetPopularItemsQueryHookResult = ReturnType<typeof useGetPopularItemsQuery>;
export type GetPopularItemsLazyQueryHookResult = ReturnType<typeof useGetPopularItemsLazyQuery>;
export type GetPopularItemsSuspenseQueryHookResult = ReturnType<typeof useGetPopularItemsSuspenseQuery>;
export type GetPopularItemsQueryResult = ApolloReactCommon.QueryResult<GetPopularItemsQuery, GetPopularItemsQueryVariables>;
export const CreateItemDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateItem"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateItemInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createItem"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"item"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"netWeight"}},{"kind":"Field","name":{"kind":"Name","value":"displayUnit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"convertedNetWeight"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"storageState"}},{"kind":"Field","name":{"kind":"Name","value":"shelfLifeDays"}},{"kind":"Field","name":{"kind":"Name","value":"shelfLifeOpenedDays"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"brands"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"brand"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"categories"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"category"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"units"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"unitId"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}},{"kind":"Field","name":{"kind":"Name","value":"packageSize"}},{"kind":"Field","name":{"kind":"Name","value":"retailUnit"}},{"kind":"Field","name":{"kind":"Name","value":"contentUnitId"}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}},{"kind":"Field","name":{"kind":"Name","value":"contentUnit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateItemMutation__
 *
 * To run a mutation, you first call `useCreateItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createItemMutation, { data, loading, error }] = useCreateItemMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateItemMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateItemMutation, CreateItemMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateItemMutation, CreateItemMutationVariables>(CreateItemDocument, options);
      }
export type CreateItemMutationHookResult = ReturnType<typeof useCreateItemMutation>;
export type CreateItemMutationResult = ApolloReactCommon.MutationResult<CreateItemMutation>;
export type CreateItemMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateItemMutation, CreateItemMutationVariables>;
export const FlagItemForReviewDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"FlagItemForReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"itemId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"reason"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"flagItemForReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"itemId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"itemId"}}},{"kind":"Argument","name":{"kind":"Name","value":"reason"},"value":{"kind":"Variable","name":{"kind":"Name","value":"reason"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"item"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useFlagItemForReviewMutation__
 *
 * To run a mutation, you first call `useFlagItemForReviewMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useFlagItemForReviewMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [flagItemForReviewMutation, { data, loading, error }] = useFlagItemForReviewMutation({
 *   variables: {
 *      itemId: // value for 'itemId'
 *      reason: // value for 'reason'
 *   },
 * });
 */
export function useFlagItemForReviewMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<FlagItemForReviewMutation, FlagItemForReviewMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<FlagItemForReviewMutation, FlagItemForReviewMutationVariables>(FlagItemForReviewDocument, options);
      }
export type FlagItemForReviewMutationHookResult = ReturnType<typeof useFlagItemForReviewMutation>;
export type FlagItemForReviewMutationResult = ApolloReactCommon.MutationResult<FlagItemForReviewMutation>;
export type FlagItemForReviewMutationOptions = ApolloReactCommon.BaseMutationOptions<FlagItemForReviewMutation, FlagItemForReviewMutationVariables>;