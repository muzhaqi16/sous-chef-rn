import type * as Types from '../../generated/schemaTypes';

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type SetDefaultHomeMutationVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
}>;

export type SetDefaultHomeMutation = {
  __typename: 'Mutation';
  setDefaultHome: {
    __typename: 'SetDefaultHomePayload';
    success: boolean;
    message: string;
    code: string;
    settings: { __typename: 'UserSettings'; id: string } | null;
    defaultPantry: {
      __typename: 'Pantry';
      id: string;
      name: string;
      isDefault: boolean;
    } | null;
  };
};

export const SetDefaultHomeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'SetDefaultHome' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'homeId' },
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
            name: { kind: 'Name', value: 'setDefaultHome' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'homeId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'homeId' },
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
                  name: { kind: 'Name', value: 'settings' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'defaultPantry' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'isDefault' },
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
  SetDefaultHomeMutation,
  SetDefaultHomeMutationVariables
>;
