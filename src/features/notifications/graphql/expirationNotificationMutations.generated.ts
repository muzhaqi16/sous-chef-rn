// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type { ExpirationNotificationFragment } from '../../../graphql/operations/fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
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
    expirationNotification:
      | ({
          __typename: 'ExpirationNotification';
        } & ExpirationNotificationFragment)
      | null;
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
    expirationNotification:
      | ({
          __typename: 'ExpirationNotification';
        } & ExpirationNotificationFragment)
      | null;
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
    expirationNotification:
      | ({
          __typename: 'ExpirationNotification';
        } & ExpirationNotificationFragment)
      | null;
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
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ExpirationNotificationFragment',
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
      name: { kind: 'Name', value: 'ExpirationNotificationFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ExpirationNotification' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notificationType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'daysUntilExpiry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'readAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionTaken' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dismissedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'genericNotificationId' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryItemId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantryItem' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'imageUrl' },
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
 * __useMarkExpirationActionMutation__
 *
 * To run a mutation, you first call `useMarkExpirationActionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useMarkExpirationActionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [markExpirationActionMutation, { data, loading, error }] = useMarkExpirationActionMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useMarkExpirationActionMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    MarkExpirationActionMutation,
    MarkExpirationActionMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    MarkExpirationActionMutation,
    MarkExpirationActionMutationVariables
  >(MarkExpirationActionDocument, options);
}
export type MarkExpirationActionMutationHookResult = ReturnType<
  typeof useMarkExpirationActionMutation
>;
export type MarkExpirationActionMutationResult =
  ApolloReactCommon.MutationResult<MarkExpirationActionMutation>;
export type MarkExpirationActionMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
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
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ExpirationNotificationFragment',
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
      name: { kind: 'Name', value: 'ExpirationNotificationFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ExpirationNotification' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notificationType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'daysUntilExpiry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'readAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionTaken' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dismissedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'genericNotificationId' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryItemId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantryItem' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'imageUrl' },
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
 * __useDismissExpirationNotificationMutation__
 *
 * To run a mutation, you first call `useDismissExpirationNotificationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDismissExpirationNotificationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [dismissExpirationNotificationMutation, { data, loading, error }] = useDismissExpirationNotificationMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useDismissExpirationNotificationMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    DismissExpirationNotificationMutation,
    DismissExpirationNotificationMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    DismissExpirationNotificationMutation,
    DismissExpirationNotificationMutationVariables
  >(DismissExpirationNotificationDocument, options);
}
export type DismissExpirationNotificationMutationHookResult = ReturnType<
  typeof useDismissExpirationNotificationMutation
>;
export type DismissExpirationNotificationMutationResult =
  ApolloReactCommon.MutationResult<DismissExpirationNotificationMutation>;
export type DismissExpirationNotificationMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
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
                      {
                        kind: 'FragmentSpread',
                        name: {
                          kind: 'Name',
                          value: 'ExpirationNotificationFragment',
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
      name: { kind: 'Name', value: 'ExpirationNotificationFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'ExpirationNotification' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'notificationType' } },
          { kind: 'Field', name: { kind: 'Name', value: 'daysUntilExpiry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'readAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionTaken' } },
          { kind: 'Field', name: { kind: 'Name', value: 'actionAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dismissedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'genericNotificationId' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'pantryItemId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantryItem' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'item' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'imageUrl' },
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
 * __useMarkExpirationNotificationAsReadMutation__
 *
 * To run a mutation, you first call `useMarkExpirationNotificationAsReadMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useMarkExpirationNotificationAsReadMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [markExpirationNotificationAsReadMutation, { data, loading, error }] = useMarkExpirationNotificationAsReadMutation({
 *   variables: {
 *      notificationId: // value for 'notificationId'
 *   },
 * });
 */
export function useMarkExpirationNotificationAsReadMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    MarkExpirationNotificationAsReadMutation,
    MarkExpirationNotificationAsReadMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    MarkExpirationNotificationAsReadMutation,
    MarkExpirationNotificationAsReadMutationVariables
  >(MarkExpirationNotificationAsReadDocument, options);
}
export type MarkExpirationNotificationAsReadMutationHookResult = ReturnType<
  typeof useMarkExpirationNotificationAsReadMutation
>;
export type MarkExpirationNotificationAsReadMutationResult =
  ApolloReactCommon.MutationResult<MarkExpirationNotificationAsReadMutation>;
export type MarkExpirationNotificationAsReadMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    MarkExpirationNotificationAsReadMutation,
    MarkExpirationNotificationAsReadMutationVariables
  >;
