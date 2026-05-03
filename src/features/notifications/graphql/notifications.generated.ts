// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type { NotificationFragment } from '../../../graphql/operations/fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type NotificationChangedSubscriptionVariables = Types.Exact<{
  [key: string]: never;
}>;

export type NotificationChangedSubscription = {
  __typename: 'Subscription';
  notificationChanged: {
    __typename: 'NotificationChangeEvent';
    changeType: Types.NotificationChangeType;
    timestamp: string;
    notification: { __typename: 'Notification' } & NotificationFragment;
  };
};

export type GetUnreadNotificationsQueryVariables = Types.Exact<{
  [key: string]: never;
}>;

export type GetUnreadNotificationsQuery = {
  __typename: 'Query';
  me: {
    __typename: 'User';
    id: string;
    notificationsConnection: {
      __typename: 'NotificationConnection';
      edges: Array<{
        __typename: 'NotificationEdge';
        node: { __typename: 'Notification' } & NotificationFragment;
      }>;
      pageInfo: {
        __typename: 'PageInfo';
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  } | null;
};

export const NotificationChangedDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'NotificationChanged' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'notificationChanged' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'changeType' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'notification' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'NotificationFragment' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'NotificationFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Notification' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'priority' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          { kind: 'Field', name: { kind: 'Name', value: 'payload' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sourceId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sourceType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'readAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useNotificationChangedSubscription__
 *
 * To run a query within a React component, call `useNotificationChangedSubscription` and pass it any options that fit your needs.
 * When your component renders, `useNotificationChangedSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useNotificationChangedSubscription({
 *   variables: {
 *   },
 * });
 */
export function useNotificationChangedSubscription(
  baseOptions?: ApolloReactHooks.SubscriptionHookOptions<
    NotificationChangedSubscription,
    NotificationChangedSubscriptionVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    NotificationChangedSubscription,
    NotificationChangedSubscriptionVariables
  >(NotificationChangedDocument, options);
}
export type NotificationChangedSubscriptionHookResult = ReturnType<
  typeof useNotificationChangedSubscription
>;
export type NotificationChangedSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<NotificationChangedSubscription>;
export const GetUnreadNotificationsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetUnreadNotifications' },
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
                  name: { kind: 'Name', value: 'notificationsConnection' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'filter' },
                      value: {
                        kind: 'ObjectValue',
                        fields: [
                          {
                            kind: 'ObjectField',
                            name: { kind: 'Name', value: 'unreadOnly' },
                            value: { kind: 'BooleanValue', value: true },
                          },
                        ],
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'first' },
                      value: { kind: 'IntValue', value: '50' },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'orderBy' },
                      value: { kind: 'EnumValue', value: 'SENT_AT_DESC' },
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
                                      value: 'NotificationFragment',
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
      name: { kind: 'Name', value: 'NotificationFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Notification' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'type' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'priority' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          { kind: 'Field', name: { kind: 'Name', value: 'payload' } },
          { kind: 'Field', name: { kind: 'Name', value: 'category' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sourceId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sourceType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'readAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetUnreadNotificationsQuery__
 *
 * To run a query within a React component, call `useGetUnreadNotificationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUnreadNotificationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUnreadNotificationsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetUnreadNotificationsQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetUnreadNotificationsQuery,
    GetUnreadNotificationsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetUnreadNotificationsQuery,
    GetUnreadNotificationsQueryVariables
  >(GetUnreadNotificationsDocument, options);
}
export function useGetUnreadNotificationsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetUnreadNotificationsQuery,
    GetUnreadNotificationsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetUnreadNotificationsQuery,
    GetUnreadNotificationsQueryVariables
  >(GetUnreadNotificationsDocument, options);
}
// @ts-ignore
export function useGetUnreadNotificationsSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetUnreadNotificationsQuery,
    GetUnreadNotificationsQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetUnreadNotificationsQuery,
  GetUnreadNotificationsQueryVariables
>;
export function useGetUnreadNotificationsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetUnreadNotificationsQuery,
        GetUnreadNotificationsQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetUnreadNotificationsQuery | undefined,
  GetUnreadNotificationsQueryVariables
>;
export function useGetUnreadNotificationsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetUnreadNotificationsQuery,
        GetUnreadNotificationsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetUnreadNotificationsQuery,
    GetUnreadNotificationsQueryVariables
  >(GetUnreadNotificationsDocument, options);
}
export type GetUnreadNotificationsQueryHookResult = ReturnType<
  typeof useGetUnreadNotificationsQuery
>;
export type GetUnreadNotificationsLazyQueryHookResult = ReturnType<
  typeof useGetUnreadNotificationsLazyQuery
>;
export type GetUnreadNotificationsSuspenseQueryHookResult = ReturnType<
  typeof useGetUnreadNotificationsSuspenseQuery
>;
export type GetUnreadNotificationsQueryResult = ApolloReactCommon.QueryResult<
  GetUnreadNotificationsQuery,
  GetUnreadNotificationsQueryVariables
>;
