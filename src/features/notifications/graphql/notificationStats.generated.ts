// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetNotificationStatsQueryVariables = Types.Exact<{
  filters?: Types.InputMaybe<Types.NotificationFilters>;
}>;

export type GetNotificationStatsQuery = {
  __typename: 'Query';
  notificationStats: {
    __typename: 'NotificationStats';
    total: number;
    unread: number;
    read: number;
    dismissed: number;
    expired: number;
    byCategory: Array<{
      __typename: 'NotificationCategoryCount';
      category: Types.NotificationCategory;
      count: number;
      unreadCount: number;
    }>;
    byPriority: Array<{
      __typename: 'NotificationPriorityCount';
      priority: Types.Priority;
      count: number;
      unreadCount: number;
    }>;
    byType: Array<{
      __typename: 'NotificationTypeCount';
      type: Types.NotificationType;
      count: number;
      unreadCount: number;
    }>;
  };
};

export const GetNotificationStatsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetNotificationStats' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'filters' },
          },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'NotificationFilters' },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'notificationStats' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filters' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'filters' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                { kind: 'Field', name: { kind: 'Name', value: 'unread' } },
                { kind: 'Field', name: { kind: 'Name', value: 'read' } },
                { kind: 'Field', name: { kind: 'Name', value: 'dismissed' } },
                { kind: 'Field', name: { kind: 'Name', value: 'expired' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'byCategory' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'category' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'unreadCount' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'byPriority' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'priority' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'unreadCount' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'byType' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'count' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'unreadCount' },
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
} as unknown as DocumentNode;

/**
 * __useGetNotificationStatsQuery__
 *
 * To run a query within a React component, call `useGetNotificationStatsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetNotificationStatsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetNotificationStatsQuery({
 *   variables: {
 *      filters: // value for 'filters'
 *   },
 * });
 */
export function useGetNotificationStatsQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetNotificationStatsQuery,
    GetNotificationStatsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetNotificationStatsQuery,
    GetNotificationStatsQueryVariables
  >(GetNotificationStatsDocument, options);
}
export function useGetNotificationStatsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetNotificationStatsQuery,
    GetNotificationStatsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetNotificationStatsQuery,
    GetNotificationStatsQueryVariables
  >(GetNotificationStatsDocument, options);
}
// @ts-ignore
export function useGetNotificationStatsSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetNotificationStatsQuery,
    GetNotificationStatsQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetNotificationStatsQuery,
  GetNotificationStatsQueryVariables
>;
export function useGetNotificationStatsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetNotificationStatsQuery,
        GetNotificationStatsQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetNotificationStatsQuery | undefined,
  GetNotificationStatsQueryVariables
>;
export function useGetNotificationStatsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetNotificationStatsQuery,
        GetNotificationStatsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetNotificationStatsQuery,
    GetNotificationStatsQueryVariables
  >(GetNotificationStatsDocument, options);
}
export type GetNotificationStatsQueryHookResult = ReturnType<
  typeof useGetNotificationStatsQuery
>;
export type GetNotificationStatsLazyQueryHookResult = ReturnType<
  typeof useGetNotificationStatsLazyQuery
>;
export type GetNotificationStatsSuspenseQueryHookResult = ReturnType<
  typeof useGetNotificationStatsSuspenseQuery
>;
export type GetNotificationStatsQueryResult = ApolloReactCommon.QueryResult<
  GetNotificationStatsQuery,
  GetNotificationStatsQueryVariables
>;
