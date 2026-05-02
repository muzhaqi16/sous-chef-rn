import type * as Types from '../../generated/schemaTypes';

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
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
} as unknown as DocumentNode<
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
} as unknown as DocumentNode<
  DeviceChangedSubscription,
  DeviceChangedSubscriptionVariables
>;
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
} as unknown as DocumentNode<
  LoginActivityChangedSubscription,
  LoginActivityChangedSubscriptionVariables
>;
