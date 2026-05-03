// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type ConvertQuantityQueryVariables = Types.Exact<{
  pantryItemId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
  quantity: Types.Scalars['Float']['input'];
  fromUnitId: Types.Scalars['ID']['input'];
  toUnitId: Types.Scalars['ID']['input'];
}>;


export type ConvertQuantityQuery = { __typename: 'Query', convertQuantity: { __typename: 'ConversionResult', value: number, displayText: string, unit: { __typename: 'Unit', id: string, name: string, symbol: string, type: Types.UnitType, displayAsFraction: boolean, minPrecision: number, autoConvertThreshold: number | null } } | null };


export const ConvertQuantityDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ConvertQuantity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pantryItemId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"quantity"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Float"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"fromUnitId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"toUnitId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"convertQuantity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pantryItemId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pantryItemId"}}},{"kind":"Argument","name":{"kind":"Name","value":"quantity"},"value":{"kind":"Variable","name":{"kind":"Name","value":"quantity"}}},{"kind":"Argument","name":{"kind":"Name","value":"fromUnitId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"fromUnitId"}}},{"kind":"Argument","name":{"kind":"Name","value":"toUnitId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"toUnitId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"displayText"}},{"kind":"Field","name":{"kind":"Name","value":"unit"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"symbol"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"displayAsFraction"}},{"kind":"Field","name":{"kind":"Name","value":"minPrecision"}},{"kind":"Field","name":{"kind":"Name","value":"autoConvertThreshold"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useConvertQuantityQuery__
 *
 * To run a query within a React component, call `useConvertQuantityQuery` and pass it any options that fit your needs.
 * When your component renders, `useConvertQuantityQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useConvertQuantityQuery({
 *   variables: {
 *      pantryItemId: // value for 'pantryItemId'
 *      quantity: // value for 'quantity'
 *      fromUnitId: // value for 'fromUnitId'
 *      toUnitId: // value for 'toUnitId'
 *   },
 * });
 */
export function useConvertQuantityQuery(baseOptions: ApolloReactHooks.QueryHookOptions<ConvertQuantityQuery, ConvertQuantityQueryVariables> & ({ variables: ConvertQuantityQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<ConvertQuantityQuery, ConvertQuantityQueryVariables>(ConvertQuantityDocument, options);
      }
export function useConvertQuantityLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<ConvertQuantityQuery, ConvertQuantityQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<ConvertQuantityQuery, ConvertQuantityQueryVariables>(ConvertQuantityDocument, options);
        }
// @ts-ignore
export function useConvertQuantitySuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<ConvertQuantityQuery, ConvertQuantityQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<ConvertQuantityQuery, ConvertQuantityQueryVariables>;
export function useConvertQuantitySuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<ConvertQuantityQuery, ConvertQuantityQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<ConvertQuantityQuery | undefined, ConvertQuantityQueryVariables>;
export function useConvertQuantitySuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<ConvertQuantityQuery, ConvertQuantityQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<ConvertQuantityQuery, ConvertQuantityQueryVariables>(ConvertQuantityDocument, options);
        }
export type ConvertQuantityQueryHookResult = ReturnType<typeof useConvertQuantityQuery>;
export type ConvertQuantityLazyQueryHookResult = ReturnType<typeof useConvertQuantityLazyQuery>;
export type ConvertQuantitySuspenseQueryHookResult = ReturnType<typeof useConvertQuantitySuspenseQuery>;
export type ConvertQuantityQueryResult = ApolloReactCommon.QueryResult<ConvertQuantityQuery, ConvertQuantityQueryVariables>;