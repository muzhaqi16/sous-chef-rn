import type * as Types from '../../generated/schemaTypes';

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type MarkExpirationActionMutationVariables = Types.Exact<{
  input: Types.MarkActionInput;
}>;

export type MarkExpirationActionMutation = {
  __typename: 'Mutation';
  markExpirationAction: {
    __typename: 'ExpirationNotificationPayload';
    success: boolean;
    message: string;
    code: string;
    expirationNotification: {
      __typename: 'ExpirationNotification';
      id: string;
      status: Types.NotificationDeliveryStatus;
      actionTaken: Types.ExpirationAction | null;
    } | null;
  };
};

export type DismissExpirationNotificationMutationVariables = Types.Exact<{
  input: Types.DismissNotificationInput;
}>;

export type DismissExpirationNotificationMutation = {
  __typename: 'Mutation';
  dismissExpirationNotification: {
    __typename: 'ExpirationNotificationPayload';
    success: boolean;
    message: string;
    code: string;
    expirationNotification: {
      __typename: 'ExpirationNotification';
      id: string;
      status: Types.NotificationDeliveryStatus;
      actionTaken: Types.ExpirationAction | null;
    } | null;
  };
};

export type MarkExpirationNotificationAsReadMutationVariables = Types.Exact<{
  notificationId: Types.Scalars['ID']['input'];
}>;

export type MarkExpirationNotificationAsReadMutation = {
  __typename: 'Mutation';
  markExpirationNotificationAsRead: {
    __typename: 'ExpirationNotificationPayload';
    success: boolean;
    message: string;
    code: string;
    expirationNotification: {
      __typename: 'ExpirationNotification';
      id: string;
      status: Types.NotificationDeliveryStatus;
      actionTaken: Types.ExpirationAction | null;
    } | null;
  };
};

export const MarkExpirationActionDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'MarkExpirationAction' },
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
              name: { kind: 'Name', value: 'MarkActionInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'markExpirationAction' },
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
                  name: { kind: 'Name', value: 'expirationNotification' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'actionTaken' },
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
  MarkExpirationActionMutation,
  MarkExpirationActionMutationVariables
>;
export const DismissExpirationNotificationDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DismissExpirationNotification' },
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
              name: { kind: 'Name', value: 'DismissNotificationInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'dismissExpirationNotification' },
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
                  name: { kind: 'Name', value: 'expirationNotification' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'actionTaken' },
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
  DismissExpirationNotificationMutation,
  DismissExpirationNotificationMutationVariables
>;
export const MarkExpirationNotificationAsReadDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'MarkExpirationNotificationAsRead' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'notificationId' },
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
            name: { kind: 'Name', value: 'markExpirationNotificationAsRead' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'notificationId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'notificationId' },
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
                  name: { kind: 'Name', value: 'expirationNotification' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'status' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'actionTaken' },
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
  MarkExpirationNotificationAsReadMutation,
  MarkExpirationNotificationAsReadMutationVariables
>;
