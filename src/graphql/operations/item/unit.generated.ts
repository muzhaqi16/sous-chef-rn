// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetUnitBySymbolQueryVariables = Types.Exact<{
  symbol: Types.Scalars['String']['input'];
}>;


export type GetUnitBySymbolQuery = { __typename: 'Query', unitBySymbol: { __typename: 'Unit', id: string, name: string, symbol: string, type: Types.UnitType, isMetric: boolean, baseUnitId: string | null, conversionFactor: number, notes: string | null, isCommon: boolean, sortOrder: number, createdAt: string, updatedAt: string, baseUnit: { __typename: 'UnitRef', id: string, name: string, symbol: string, type: Types.UnitType } | null } | null };

export type SearchUnitsQueryVariables = Types.Exact<{
  query: Types.Scalars['String']['input'];
  type?: Types.InputMaybe<Types.UnitType>;
  limit?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type SearchUnitsQuery = { __typename: 'Query', searchUnits: Array<{ __typename: 'Unit', id: string, name: string, symbol: string, type: Types.UnitType, isMetric: boolean, isCommon: boolean, sortOrder: number, displayAsFraction: boolean, minPrecision: number, conversionFactor: number, baseUnitId: string | null }> };

export type GetCommonUnitsQueryVariables = Types.Exact<{
  type?: Types.InputMaybe<Types.UnitType>;
  limit?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;


export type GetCommonUnitsQuery = { __typename: 'Query', units: Array<{ __typename: 'Unit', id: string, name: string, symbol: string, type: Types.UnitType, isMetric: boolean, isCommon: boolean, sortOrder: number, displayAsFraction: boolean, minPrecision: number, conversionFactor: number, baseUnitId: string | null }> };


export const GetUnitBySymbolDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUnitBySymbol"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"symbol"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unitBySymbol"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"symbol"},"value":{"kind":"Variable","name":{"kind":"Name","value":"symbol"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isMetric"}},{"kind":"Field","name":{"kind":"Name","value":"baseUnitId"}},{"kind":"Field","name":{"kind":"Name","value":"conversionFactor"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"isCommon"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"baseUnit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useGetUnitBySymbolQuery__
 *
 * To run a query within a React component, call `useGetUnitBySymbolQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUnitBySymbolQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUnitBySymbolQuery({
 *   variables: {
 *      symbol: // value for 'symbol'
 *   },
 * });
 */
export function useGetUnitBySymbolQuery(baseOptions: ApolloReactHooks.QueryHookOptions<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables> & ({ variables: GetUnitBySymbolQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables>(GetUnitBySymbolDocument, options);
      }
export function useGetUnitBySymbolLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables>(GetUnitBySymbolDocument, options);
        }
// @ts-ignore
export function useGetUnitBySymbolSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables>;
export function useGetUnitBySymbolSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetUnitBySymbolQuery | undefined, GetUnitBySymbolQueryVariables>;
export function useGetUnitBySymbolSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables>(GetUnitBySymbolDocument, options);
        }
export type GetUnitBySymbolQueryHookResult = ReturnType<typeof useGetUnitBySymbolQuery>;
export type GetUnitBySymbolLazyQueryHookResult = ReturnType<typeof useGetUnitBySymbolLazyQuery>;
export type GetUnitBySymbolSuspenseQueryHookResult = ReturnType<typeof useGetUnitBySymbolSuspenseQuery>;
export type GetUnitBySymbolQueryResult = ApolloReactCommon.QueryResult<GetUnitBySymbolQuery, GetUnitBySymbolQueryVariables>;
export const SearchUnitsDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchUnits"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"query"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"UnitType"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"searchUnits"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"query"},"value":{"kind":"Variable","name":{"kind":"Name","value":"query"}}},{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isMetric"}},{"kind":"Field","name":{"kind":"Name","value":"isCommon"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"displayAsFraction"}},{"kind":"Field","name":{"kind":"Name","value":"minPrecision"}},{"kind":"Field","name":{"kind":"Name","value":"conversionFactor"}},{"kind":"Field","name":{"kind":"Name","value":"baseUnitId"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useSearchUnitsQuery__
 *
 * To run a query within a React component, call `useSearchUnitsQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchUnitsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchUnitsQuery({
 *   variables: {
 *      query: // value for 'query'
 *      type: // value for 'type'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchUnitsQuery(baseOptions: ApolloReactHooks.QueryHookOptions<SearchUnitsQuery, SearchUnitsQueryVariables> & ({ variables: SearchUnitsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<SearchUnitsQuery, SearchUnitsQueryVariables>(SearchUnitsDocument, options);
      }
export function useSearchUnitsLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<SearchUnitsQuery, SearchUnitsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<SearchUnitsQuery, SearchUnitsQueryVariables>(SearchUnitsDocument, options);
        }
// @ts-ignore
export function useSearchUnitsSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<SearchUnitsQuery, SearchUnitsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SearchUnitsQuery, SearchUnitsQueryVariables>;
export function useSearchUnitsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SearchUnitsQuery, SearchUnitsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<SearchUnitsQuery | undefined, SearchUnitsQueryVariables>;
export function useSearchUnitsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<SearchUnitsQuery, SearchUnitsQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<SearchUnitsQuery, SearchUnitsQueryVariables>(SearchUnitsDocument, options);
        }
export type SearchUnitsQueryHookResult = ReturnType<typeof useSearchUnitsQuery>;
export type SearchUnitsLazyQueryHookResult = ReturnType<typeof useSearchUnitsLazyQuery>;
export type SearchUnitsSuspenseQueryHookResult = ReturnType<typeof useSearchUnitsSuspenseQuery>;
export type SearchUnitsQueryResult = ApolloReactCommon.QueryResult<SearchUnitsQuery, SearchUnitsQueryVariables>;
export const GetCommonUnitsDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCommonUnits"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"UnitType"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"units"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"isCommon"},"value":{"kind":"BooleanValue","value":true}},{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"isMetric"}},{"kind":"Field","name":{"kind":"Name","value":"isCommon"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"displayAsFraction"}},{"kind":"Field","name":{"kind":"Name","value":"minPrecision"}},{"kind":"Field","name":{"kind":"Name","value":"conversionFactor"}},{"kind":"Field","name":{"kind":"Name","value":"baseUnitId"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useGetCommonUnitsQuery__
 *
 * To run a query within a React component, call `useGetCommonUnitsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetCommonUnitsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetCommonUnitsQuery({
 *   variables: {
 *      type: // value for 'type'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useGetCommonUnitsQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>(GetCommonUnitsDocument, options);
      }
export function useGetCommonUnitsLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>(GetCommonUnitsDocument, options);
        }
// @ts-ignore
export function useGetCommonUnitsSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>;
export function useGetCommonUnitsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetCommonUnitsQuery | undefined, GetCommonUnitsQueryVariables>;
export function useGetCommonUnitsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>(GetCommonUnitsDocument, options);
        }
export type GetCommonUnitsQueryHookResult = ReturnType<typeof useGetCommonUnitsQuery>;
export type GetCommonUnitsLazyQueryHookResult = ReturnType<typeof useGetCommonUnitsLazyQuery>;
export type GetCommonUnitsSuspenseQueryHookResult = ReturnType<typeof useGetCommonUnitsSuspenseQuery>;
export type GetCommonUnitsQueryResult = ApolloReactCommon.QueryResult<GetCommonUnitsQuery, GetCommonUnitsQueryVariables>;