import type * as Types from '../../generated/schemaTypes';

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
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
} as unknown as DocumentNode<
  GetNotificationStatsQuery,
  GetNotificationStatsQueryVariables
>;
