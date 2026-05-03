// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type RegisterDeviceMutationVariables = Types.Exact<{
  input: Types.DeviceRegistrationInput;
}>;

export type RegisterDeviceMutation = {
  __typename: 'Mutation';
  registerDevice: {
    __typename: 'DevicePayload';
    success: boolean;
    message: string;
    code: string;
  };
};

export type DeviceChangedSubscriptionVariables = Types.Exact<{
  userId: Types.Scalars['ID']['input'];
}>;

export type DeviceChangedSubscription = {
  __typename: 'Subscription';
  deviceChanged: {
    __typename: 'DeviceChangeEvent';
    changeType: Types.DeviceChangeType;
    userId: string;
    timestamp: string;
    device: {
      __typename: 'Device';
      id: string;
      deviceName: string | null;
      deviceType: Types.DeviceType;
      isTrusted: boolean;
      lastSeenAt: string;
    };
  };
};

export type LoginActivityChangedSubscriptionVariables = Types.Exact<{
  userId: Types.Scalars['ID']['input'];
}>;

export type LoginActivityChangedSubscription = {
  __typename: 'Subscription';
  loginActivityChanged: {
    __typename: 'LoginActivityEvent';
    activityType: Types.LoginActivityType;
    userId: string;
    timestamp: string;
    loginHistory: {
      __typename: 'LoginHistory';
      id: string;
      ipCity: string | null;
      ipCountry: string | null;
      deviceType: Types.DeviceType | null;
      browserName: string | null;
      createdAt: string;
    } | null;
    suspiciousActivity: {
      __typename: 'SuspiciousActivity';
      suspiciousActivity: boolean;
    } | null;
  };
};

export const RegisterDeviceDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'RegisterDevice' },
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
              name: { kind: 'Name', value: 'DeviceRegistrationInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'registerDevice' },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useRegisterDeviceMutation__
 *
 * To run a mutation, you first call `useRegisterDeviceMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRegisterDeviceMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [registerDeviceMutation, { data, loading, error }] = useRegisterDeviceMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useRegisterDeviceMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    RegisterDeviceMutation,
    RegisterDeviceMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    RegisterDeviceMutation,
    RegisterDeviceMutationVariables
  >(RegisterDeviceDocument, options);
}
export type RegisterDeviceMutationHookResult = ReturnType<
  typeof useRegisterDeviceMutation
>;
export type RegisterDeviceMutationResult =
  ApolloReactCommon.MutationResult<RegisterDeviceMutation>;
export type RegisterDeviceMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    RegisterDeviceMutation,
    RegisterDeviceMutationVariables
  >;
export const DeviceChangedDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'DeviceChanged' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'userId' },
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
            name: { kind: 'Name', value: 'deviceChanged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'userId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'userId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'changeType' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'device' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'deviceName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'deviceType' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isTrusted' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastSeenAt' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useDeviceChangedSubscription__
 *
 * To run a query within a React component, call `useDeviceChangedSubscription` and pass it any options that fit your needs.
 * When your component renders, `useDeviceChangedSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useDeviceChangedSubscription({
 *   variables: {
 *      userId: // value for 'userId'
 *   },
 * });
 */
export function useDeviceChangedSubscription(
  baseOptions: ApolloReactHooks.SubscriptionHookOptions<
    DeviceChangedSubscription,
    DeviceChangedSubscriptionVariables
  > &
    (
      | { variables: DeviceChangedSubscriptionVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    DeviceChangedSubscription,
    DeviceChangedSubscriptionVariables
  >(DeviceChangedDocument, options);
}
export type DeviceChangedSubscriptionHookResult = ReturnType<
  typeof useDeviceChangedSubscription
>;
export type DeviceChangedSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<DeviceChangedSubscription>;
export const LoginActivityChangedDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'LoginActivityChanged' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'userId' },
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
            name: { kind: 'Name', value: 'loginActivityChanged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'userId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'userId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'activityType' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'loginHistory' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'ipCity' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'ipCountry' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'deviceType' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'browserName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'suspiciousActivity' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'suspiciousActivity' },
                      },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useLoginActivityChangedSubscription__
 *
 * To run a query within a React component, call `useLoginActivityChangedSubscription` and pass it any options that fit your needs.
 * When your component renders, `useLoginActivityChangedSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useLoginActivityChangedSubscription({
 *   variables: {
 *      userId: // value for 'userId'
 *   },
 * });
 */
export function useLoginActivityChangedSubscription(
  baseOptions: ApolloReactHooks.SubscriptionHookOptions<
    LoginActivityChangedSubscription,
    LoginActivityChangedSubscriptionVariables
  > &
    (
      | { variables: LoginActivityChangedSubscriptionVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    LoginActivityChangedSubscription,
    LoginActivityChangedSubscriptionVariables
  >(LoginActivityChangedDocument, options);
}
export type LoginActivityChangedSubscriptionHookResult = ReturnType<
  typeof useLoginActivityChangedSubscription
>;
export type LoginActivityChangedSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<LoginActivityChangedSubscription>;
