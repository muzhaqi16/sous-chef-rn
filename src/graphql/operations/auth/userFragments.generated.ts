import type * as Types from '../../generated/schemaTypes';

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type UserSummaryFragment = {
  __typename: 'User';
  id: string;
  email: string;
  profile: {
    __typename: 'UserProfile';
    id: string;
    displayName: string | null;
    avatar: string | null;
  } | null;
};

export type LoginUserFragment = {
  __typename: 'User';
  id: string;
  email: string;
  emailVerified: boolean;
  role: Types.UserRole;
  canAccessDevTools: boolean;
  onBoarded: boolean;
  createdAt: string;
  updatedAt: string;
  timezone: string | null;
  defaultHomeId: string | null;
  defaultShoppingListId: string | null;
  defaultHome: {
    __typename: 'Home';
    id: string;
    name: string;
    isDefault: boolean;
    pantriesConnection: {
      __typename: 'PantryConnection';
      edges: Array<{
        __typename: 'PantryEdge';
        node: { __typename: 'Pantry'; id: string; isDefault: boolean };
      }>;
    };
  } | null;
  profile: {
    __typename: 'UserProfile';
    id: string;
    displayName: string | null;
    avatar: string | null;
  } | null;
  settings: {
    __typename: 'UserSettings';
    id: string;
    theme: Types.AppTheme;
  } | null;
};

export type PartialUserFragment = {
  __typename: 'User';
  id: string;
  email: string;
  emailVerified: boolean;
  role: Types.UserRole;
  canAccessDevTools: boolean;
  onBoarded: boolean;
  timezone: string | null;
  defaultShoppingListId: string | null;
  defaultHomeId: string | null;
  createdAt: string;
  updatedAt: string;
  profile: {
    __typename: 'UserProfile';
    id: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    avatar: string | null;
  } | null;
  settings: {
    __typename: 'UserSettings';
    id: string;
    theme: Types.AppTheme;
  } | null;
};

export const UserSummaryFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSummary' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<UserSummaryFragment, unknown>;
export const LoginUserFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'LoginUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'emailVerified' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAccessDevTools' } },
          { kind: 'Field', name: { kind: 'Name', value: 'onBoarded' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'timezone' } },
          { kind: 'Field', name: { kind: 'Name', value: 'defaultHomeId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultShoppingListId' },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultHome' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'pantriesConnection' },
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
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'settings' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'theme' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<LoginUserFragment, unknown>;
export const PartialUserFragmentDoc = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PartialUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'emailVerified' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAccessDevTools' } },
          { kind: 'Field', name: { kind: 'Name', value: 'onBoarded' } },
          { kind: 'Field', name: { kind: 'Name', value: 'timezone' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultShoppingListId' },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'defaultHomeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'profile' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'firstName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                { kind: 'Field', name: { kind: 'Name', value: 'avatar' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'settings' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'theme' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<PartialUserFragment, unknown>;
