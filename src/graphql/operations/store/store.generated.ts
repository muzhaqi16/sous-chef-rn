// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type SearchStoresQueryVariables = Types.Exact<{
  search: Types.Scalars['String']['input'];
  limit?: Types.InputMaybe<Types.Scalars['Int']['input']>;
}>;

export type SearchStoresQuery = {
  __typename: 'Query';
  stores: {
    __typename: 'StoreConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'StoreEdge';
      node: {
        __typename: 'Store';
        id: string;
        name: string;
        address: string | null;
      };
    }>;
  };
};

export const SearchStoresDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'SearchStores' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'search' },
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
            name: { kind: 'Name', value: 'limit' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'stores' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filters' },
                value: {
                  kind: 'ObjectValue',
                  fields: [
                    {
                      kind: 'ObjectField',
                      name: { kind: 'Name', value: 'search' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'search' },
                      },
                    },
                  ],
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'limit' },
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
                              name: { kind: 'Name', value: 'name' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'address' },
                            },
                          ],
                        },
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
  ],
} as unknown as DocumentNode;

/**
 * __useSearchStoresQuery__
 *
 * To run a query within a React component, call `useSearchStoresQuery` and pass it any options that fit your needs.
 * When your component renders, `useSearchStoresQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useSearchStoresQuery({
 *   variables: {
 *      search: // value for 'search'
 *      limit: // value for 'limit'
 *   },
 * });
 */
export function useSearchStoresQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    SearchStoresQuery,
    SearchStoresQueryVariables
  > &
    (
      | { variables: SearchStoresQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    SearchStoresQuery,
    SearchStoresQueryVariables
  >(SearchStoresDocument, options);
}
export function useSearchStoresLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    SearchStoresQuery,
    SearchStoresQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    SearchStoresQuery,
    SearchStoresQueryVariables
  >(SearchStoresDocument, options);
}
// @ts-ignore
export function useSearchStoresSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    SearchStoresQuery,
    SearchStoresQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  SearchStoresQuery,
  SearchStoresQueryVariables
>;
export function useSearchStoresSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        SearchStoresQuery,
        SearchStoresQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  SearchStoresQuery | undefined,
  SearchStoresQueryVariables
>;
export function useSearchStoresSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        SearchStoresQuery,
        SearchStoresQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    SearchStoresQuery,
    SearchStoresQueryVariables
  >(SearchStoresDocument, options);
}
export type SearchStoresQueryHookResult = ReturnType<
  typeof useSearchStoresQuery
>;
export type SearchStoresLazyQueryHookResult = ReturnType<
  typeof useSearchStoresLazyQuery
>;
export type SearchStoresSuspenseQueryHookResult = ReturnType<
  typeof useSearchStoresSuspenseQuery
>;
export type SearchStoresQueryResult = ApolloReactCommon.QueryResult<
  SearchStoresQuery,
  SearchStoresQueryVariables
>;
