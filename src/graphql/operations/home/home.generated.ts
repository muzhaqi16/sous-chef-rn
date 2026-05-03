// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type {
  HomeFragment,
  HomeListFragment,
  HomeInviteFragment,
  HomeDisplayFragment,
  MemberShipFragment,
} from '../fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetHomeQueryVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
}>;

export type GetHomeQuery = {
  __typename: 'Query';
  home: ({ __typename: 'Home' } & HomeFragment) | null;
};

export type GetHomesQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;

export type GetHomesQuery = {
  __typename: 'Query';
  homes: {
    __typename: 'HomeConnection';
    totalCount: number | null;
    edges: Array<{
      __typename: 'HomeEdge';
      cursor: string;
      node: { __typename: 'Home' } & HomeListFragment;
    }>;
    pageInfo: {
      __typename: 'PageInfo';
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
};

export type GetMyPendingInvitesQueryVariables = Types.Exact<{
  [key: string]: never;
}>;

export type GetMyPendingInvitesQuery = {
  __typename: 'Query';
  me: {
    __typename: 'User';
    id: string;
    pendingHomeInvites: Array<
      { __typename: 'HomeInvite' } & HomeInviteFragment
    >;
  } | null;
};

export type GetHomeByJoinCodeQueryVariables = Types.Exact<{
  joinCode: Types.Scalars['String']['input'];
}>;

export type GetHomeByJoinCodeQuery = {
  __typename: 'Query';
  homeByJoinCode: ({ __typename: 'Home' } & HomeDisplayFragment) | null;
};

export type CreateHomeMutationVariables = Types.Exact<{
  input: Types.CreateHomeInput;
}>;

export type CreateHomeMutation = {
  __typename: 'Mutation';
  createHome: {
    __typename: 'HomePayload';
    success: boolean;
    message: string;
    code: string;
    home: ({ __typename: 'Home' } & HomeListFragment) | null;
  };
};

export type UpdateHomeMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateHomeInput;
}>;

export type UpdateHomeMutation = {
  __typename: 'Mutation';
  updateHome: {
    __typename: 'HomePayload';
    success: boolean;
    message: string;
    code: string;
    home: {
      __typename: 'Home';
      id: string;
      name: string;
      allowJoinCode: boolean;
      joinCode: string | null;
      version: number;
      updatedAt: string;
    } | null;
  };
};

export type DeleteHomeMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type DeleteHomeMutation = {
  __typename: 'Mutation';
  deleteHome: {
    __typename: 'HomePayload';
    success: boolean;
    message: string;
    code: string;
    home: { __typename: 'Home'; id: string; name: string } | null;
  };
};

export type InviteToHomeMutationVariables = Types.Exact<{
  input: Types.InviteToHomeInput;
}>;

export type InviteToHomeMutation = {
  __typename: 'Mutation';
  inviteToHome: {
    __typename: 'HomeInvitePayload';
    success: boolean;
    message: string;
    code: string;
    homeInvite: ({ __typename: 'HomeInvite' } & HomeInviteFragment) | null;
  };
};

export type AcceptHomeInviteMutationVariables = Types.Exact<{
  token: Types.Scalars['String']['input'];
}>;

export type AcceptHomeInviteMutation = {
  __typename: 'Mutation';
  acceptHomeInvite: {
    __typename: 'MembershipPayload';
    success: boolean;
    message: string;
    code: string;
    membership: ({ __typename: 'Membership' } & MemberShipFragment) | null;
  };
};

export type DeclineHomeInviteMutationVariables = Types.Exact<{
  token: Types.Scalars['String']['input'];
}>;

export type DeclineHomeInviteMutation = {
  __typename: 'Mutation';
  declineHomeInvite: {
    __typename: 'HomeInvitePayload';
    success: boolean;
    message: string;
    code: string;
    homeInvite: { __typename: 'HomeInvite'; id: string } | null;
  };
};

export type UpdateMembershipMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateMembershipInput;
}>;

export type UpdateMembershipMutation = {
  __typename: 'Mutation';
  updateMembership: {
    __typename: 'MembershipPayload';
    success: boolean;
    message: string;
    code: string;
    membership: ({ __typename: 'Membership' } & MemberShipFragment) | null;
  };
};

export type RemoveMemberMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type RemoveMemberMutation = {
  __typename: 'Mutation';
  removeMember: {
    __typename: 'MembershipPayload';
    success: boolean;
    message: string;
    code: string;
    membership: { __typename: 'Membership'; id: string } | null;
  };
};

export type RevokeHomeInviteMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;

export type RevokeHomeInviteMutation = {
  __typename: 'Mutation';
  revokeHomeInvite: {
    __typename: 'HomeInvitePayload';
    success: boolean;
    message: string;
    code: string;
    homeInvite: { __typename: 'HomeInvite'; id: string } | null;
  };
};

export type JoinHomeByCodeMutationVariables = Types.Exact<{
  joinCode: Types.Scalars['String']['input'];
}>;

export type JoinHomeByCodeMutation = {
  __typename: 'Mutation';
  joinHomeByCode: {
    __typename: 'MembershipPayload';
    success: boolean;
    message: string;
    code: string;
    membership: ({ __typename: 'Membership' } & MemberShipFragment) | null;
  };
};

export type LeaveHomeMutationVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
}>;

export type LeaveHomeMutation = {
  __typename: 'Mutation';
  leaveHome: {
    __typename: 'MembershipPayload';
    success: boolean;
    message: string;
    code: string;
    membership: { __typename: 'Membership'; id: string } | null;
  };
};

export type HomeInviteChangedSubscriptionVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
}>;

export type HomeInviteChangedSubscription = {
  __typename: 'Subscription';
  homeInviteChanged: {
    __typename: 'HomeInviteChangeEvent';
    mutation: Types.HomeInviteMutationType;
    homeId: string;
    userId: string;
    timestamp: string;
    homeInvite: { __typename: 'HomeInvite' } & HomeInviteFragment;
  };
};

export const GetHomeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetHome' },
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
            name: { kind: 'Name', value: 'home' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'homeId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'HomeFragment' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Home' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'timezone' } },
          { kind: 'Field', name: { kind: 'Name', value: 'currency' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isPublic' } },
          { kind: 'Field', name: { kind: 'Name', value: 'joinCode' } },
          { kind: 'Field', name: { kind: 'Name', value: 'allowJoinCode' } },
          { kind: 'Field', name: { kind: 'Name', value: 'maxMembers' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'invitesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '20' },
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
                              name: { kind: 'Name', value: 'email' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'recipientName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'membersConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '20' },
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
                              name: { kind: 'Name', value: 'homeId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'userId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'displayName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'canManageHome' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'user' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'id' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'email' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantriesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '20' },
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
                              name: { kind: 'Name', value: 'isDefault' },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'myMembership' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canManageHome' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canViewPantry' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canEditPantry' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canRemoveItems' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canInviteOthers' },
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
 * __useGetHomeQuery__
 *
 * To run a query within a React component, call `useGetHomeQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetHomeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetHomeQuery({
 *   variables: {
 *      homeId: // value for 'homeId'
 *   },
 * });
 */
export function useGetHomeQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetHomeQuery,
    GetHomeQueryVariables
  > &
    ({ variables: GetHomeQueryVariables; skip?: boolean } | { skip: boolean }),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetHomeQuery, GetHomeQueryVariables>(
    GetHomeDocument,
    options,
  );
}
export function useGetHomeLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetHomeQuery,
    GetHomeQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<GetHomeQuery, GetHomeQueryVariables>(
    GetHomeDocument,
    options,
  );
}
// @ts-ignore
export function useGetHomeSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetHomeQuery,
    GetHomeQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<GetHomeQuery, GetHomeQueryVariables>;
export function useGetHomeSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetHomeQuery,
        GetHomeQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetHomeQuery | undefined,
  GetHomeQueryVariables
>;
export function useGetHomeSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetHomeQuery,
        GetHomeQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<GetHomeQuery, GetHomeQueryVariables>(
    GetHomeDocument,
    options,
  );
}
export type GetHomeQueryHookResult = ReturnType<typeof useGetHomeQuery>;
export type GetHomeLazyQueryHookResult = ReturnType<typeof useGetHomeLazyQuery>;
export type GetHomeSuspenseQueryHookResult = ReturnType<
  typeof useGetHomeSuspenseQuery
>;
export type GetHomeQueryResult = ApolloReactCommon.QueryResult<
  GetHomeQuery,
  GetHomeQueryVariables
>;
export const GetHomesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetHomes' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'first' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'after' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'homes' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'first' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'after' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'after' },
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
                        name: { kind: 'Name', value: 'cursor' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'node' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'HomeListFragment' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'totalCount' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeListFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Home' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'membersConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '5' },
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
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'userId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'displayName' },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'invitesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '5' },
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
                              name: { kind: 'Name', value: 'email' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'recipientName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantriesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '10' },
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
                              name: { kind: 'Name', value: 'isDefault' },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'myMembership' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canManageHome' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canViewPantry' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canEditPantry' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canRemoveItems' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canInviteOthers' },
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
 * __useGetHomesQuery__
 *
 * To run a query within a React component, call `useGetHomesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetHomesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetHomesQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *   },
 * });
 */
export function useGetHomesQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetHomesQuery,
    GetHomesQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetHomesQuery, GetHomesQueryVariables>(
    GetHomesDocument,
    options,
  );
}
export function useGetHomesLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetHomesQuery,
    GetHomesQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<GetHomesQuery, GetHomesQueryVariables>(
    GetHomesDocument,
    options,
  );
}
// @ts-ignore
export function useGetHomesSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetHomesQuery,
    GetHomesQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetHomesQuery,
  GetHomesQueryVariables
>;
export function useGetHomesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetHomesQuery,
        GetHomesQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetHomesQuery | undefined,
  GetHomesQueryVariables
>;
export function useGetHomesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetHomesQuery,
        GetHomesQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetHomesQuery,
    GetHomesQueryVariables
  >(GetHomesDocument, options);
}
export type GetHomesQueryHookResult = ReturnType<typeof useGetHomesQuery>;
export type GetHomesLazyQueryHookResult = ReturnType<
  typeof useGetHomesLazyQuery
>;
export type GetHomesSuspenseQueryHookResult = ReturnType<
  typeof useGetHomesSuspenseQuery
>;
export type GetHomesQueryResult = ApolloReactCommon.QueryResult<
  GetHomesQuery,
  GetHomesQueryVariables
>;
export const GetMyPendingInvitesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetMyPendingInvites' },
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
                  name: { kind: 'Name', value: 'pendingHomeInvites' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'HomeInviteFragment' },
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
      name: { kind: 'Name', value: 'HomeInviteFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'HomeInvite' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'token' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'invitedUserId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'recipientName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'inviter' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BasicUser' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
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
      name: { kind: 'Name', value: 'BasicUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetMyPendingInvitesQuery__
 *
 * To run a query within a React component, call `useGetMyPendingInvitesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetMyPendingInvitesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetMyPendingInvitesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetMyPendingInvitesQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetMyPendingInvitesQuery,
    GetMyPendingInvitesQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetMyPendingInvitesQuery,
    GetMyPendingInvitesQueryVariables
  >(GetMyPendingInvitesDocument, options);
}
export function useGetMyPendingInvitesLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetMyPendingInvitesQuery,
    GetMyPendingInvitesQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetMyPendingInvitesQuery,
    GetMyPendingInvitesQueryVariables
  >(GetMyPendingInvitesDocument, options);
}
// @ts-ignore
export function useGetMyPendingInvitesSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetMyPendingInvitesQuery,
    GetMyPendingInvitesQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetMyPendingInvitesQuery,
  GetMyPendingInvitesQueryVariables
>;
export function useGetMyPendingInvitesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetMyPendingInvitesQuery,
        GetMyPendingInvitesQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetMyPendingInvitesQuery | undefined,
  GetMyPendingInvitesQueryVariables
>;
export function useGetMyPendingInvitesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetMyPendingInvitesQuery,
        GetMyPendingInvitesQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetMyPendingInvitesQuery,
    GetMyPendingInvitesQueryVariables
  >(GetMyPendingInvitesDocument, options);
}
export type GetMyPendingInvitesQueryHookResult = ReturnType<
  typeof useGetMyPendingInvitesQuery
>;
export type GetMyPendingInvitesLazyQueryHookResult = ReturnType<
  typeof useGetMyPendingInvitesLazyQuery
>;
export type GetMyPendingInvitesSuspenseQueryHookResult = ReturnType<
  typeof useGetMyPendingInvitesSuspenseQuery
>;
export type GetMyPendingInvitesQueryResult = ApolloReactCommon.QueryResult<
  GetMyPendingInvitesQuery,
  GetMyPendingInvitesQueryVariables
>;
export const GetHomeByJoinCodeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetHomeByJoinCode' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'joinCode' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'String' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'homeByJoinCode' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'joinCode' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'joinCode' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'HomeDisplay' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BasicUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Home' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'membersConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '10' },
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
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'userId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'displayName' },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'invitesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '10' },
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
                                value: 'HomeInviteDisplay',
                              },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantriesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '20' },
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
                                value: 'BasicPantryFragment',
                              },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'myMembership' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                { kind: 'Field', name: { kind: 'Name', value: 'status' } },
                { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canManageHome' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canViewPantry' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canEditPantry' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canRemoveItems' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canInviteOthers' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeInviteDisplay' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'HomeInvite' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'recipientName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'inviter' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BasicUser' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
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
      name: { kind: 'Name', value: 'BasicPantryFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Pantry' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useGetHomeByJoinCodeQuery__
 *
 * To run a query within a React component, call `useGetHomeByJoinCodeQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetHomeByJoinCodeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetHomeByJoinCodeQuery({
 *   variables: {
 *      joinCode: // value for 'joinCode'
 *   },
 * });
 */
export function useGetHomeByJoinCodeQuery(
  baseOptions: ApolloReactHooks.QueryHookOptions<
    GetHomeByJoinCodeQuery,
    GetHomeByJoinCodeQueryVariables
  > &
    (
      | { variables: GetHomeByJoinCodeQueryVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetHomeByJoinCodeQuery,
    GetHomeByJoinCodeQueryVariables
  >(GetHomeByJoinCodeDocument, options);
}
export function useGetHomeByJoinCodeLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetHomeByJoinCodeQuery,
    GetHomeByJoinCodeQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetHomeByJoinCodeQuery,
    GetHomeByJoinCodeQueryVariables
  >(GetHomeByJoinCodeDocument, options);
}
// @ts-ignore
export function useGetHomeByJoinCodeSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetHomeByJoinCodeQuery,
    GetHomeByJoinCodeQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetHomeByJoinCodeQuery,
  GetHomeByJoinCodeQueryVariables
>;
export function useGetHomeByJoinCodeSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetHomeByJoinCodeQuery,
        GetHomeByJoinCodeQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetHomeByJoinCodeQuery | undefined,
  GetHomeByJoinCodeQueryVariables
>;
export function useGetHomeByJoinCodeSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetHomeByJoinCodeQuery,
        GetHomeByJoinCodeQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetHomeByJoinCodeQuery,
    GetHomeByJoinCodeQueryVariables
  >(GetHomeByJoinCodeDocument, options);
}
export type GetHomeByJoinCodeQueryHookResult = ReturnType<
  typeof useGetHomeByJoinCodeQuery
>;
export type GetHomeByJoinCodeLazyQueryHookResult = ReturnType<
  typeof useGetHomeByJoinCodeLazyQuery
>;
export type GetHomeByJoinCodeSuspenseQueryHookResult = ReturnType<
  typeof useGetHomeByJoinCodeSuspenseQuery
>;
export type GetHomeByJoinCodeQueryResult = ApolloReactCommon.QueryResult<
  GetHomeByJoinCodeQuery,
  GetHomeByJoinCodeQueryVariables
>;
export const CreateHomeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CreateHome' },
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
              name: { kind: 'Name', value: 'CreateHomeInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'createHome' },
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
                  name: { kind: 'Name', value: 'home' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'HomeListFragment' },
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
      name: { kind: 'Name', value: 'HomeListFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Home' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isDefault' } },
          { kind: 'Field', name: { kind: 'Name', value: 'version' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'membersConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '5' },
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
                              name: { kind: 'Name', value: 'role' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'userId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'displayName' },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'invitesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '5' },
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
                              name: { kind: 'Name', value: 'email' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'recipientName' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'status' },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'pantriesConnection' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'first' },
                value: { kind: 'IntValue', value: '10' },
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
                              name: { kind: 'Name', value: 'isDefault' },
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
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'myMembership' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canManageHome' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canViewPantry' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canEditPantry' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canRemoveItems' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canInviteOthers' },
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
 * __useCreateHomeMutation__
 *
 * To run a mutation, you first call `useCreateHomeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateHomeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createHomeMutation, { data, loading, error }] = useCreateHomeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateHomeMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    CreateHomeMutation,
    CreateHomeMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    CreateHomeMutation,
    CreateHomeMutationVariables
  >(CreateHomeDocument, options);
}
export type CreateHomeMutationHookResult = ReturnType<
  typeof useCreateHomeMutation
>;
export type CreateHomeMutationResult =
  ApolloReactCommon.MutationResult<CreateHomeMutation>;
export type CreateHomeMutationOptions = ApolloReactCommon.BaseMutationOptions<
  CreateHomeMutation,
  CreateHomeMutationVariables
>;
export const UpdateHomeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateHome' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
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
              name: { kind: 'Name', value: 'UpdateHomeInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateHome' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
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
                  name: { kind: 'Name', value: 'home' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'allowJoinCode' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'joinCode' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'version' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
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
 * __useUpdateHomeMutation__
 *
 * To run a mutation, you first call `useUpdateHomeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateHomeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateHomeMutation, { data, loading, error }] = useUpdateHomeMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateHomeMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateHomeMutation,
    UpdateHomeMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateHomeMutation,
    UpdateHomeMutationVariables
  >(UpdateHomeDocument, options);
}
export type UpdateHomeMutationHookResult = ReturnType<
  typeof useUpdateHomeMutation
>;
export type UpdateHomeMutationResult =
  ApolloReactCommon.MutationResult<UpdateHomeMutation>;
export type UpdateHomeMutationOptions = ApolloReactCommon.BaseMutationOptions<
  UpdateHomeMutation,
  UpdateHomeMutationVariables
>;
export const DeleteHomeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteHome' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
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
            name: { kind: 'Name', value: 'deleteHome' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
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
                  name: { kind: 'Name', value: 'home' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
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
 * __useDeleteHomeMutation__
 *
 * To run a mutation, you first call `useDeleteHomeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteHomeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteHomeMutation, { data, loading, error }] = useDeleteHomeMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteHomeMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    DeleteHomeMutation,
    DeleteHomeMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    DeleteHomeMutation,
    DeleteHomeMutationVariables
  >(DeleteHomeDocument, options);
}
export type DeleteHomeMutationHookResult = ReturnType<
  typeof useDeleteHomeMutation
>;
export type DeleteHomeMutationResult =
  ApolloReactCommon.MutationResult<DeleteHomeMutation>;
export type DeleteHomeMutationOptions = ApolloReactCommon.BaseMutationOptions<
  DeleteHomeMutation,
  DeleteHomeMutationVariables
>;
export const InviteToHomeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'InviteToHome' },
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
              name: { kind: 'Name', value: 'InviteToHomeInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'inviteToHome' },
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
                  name: { kind: 'Name', value: 'homeInvite' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'HomeInviteFragment' },
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
      name: { kind: 'Name', value: 'HomeInviteFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'HomeInvite' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'token' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'invitedUserId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'recipientName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'inviter' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BasicUser' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
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
      name: { kind: 'Name', value: 'BasicUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useInviteToHomeMutation__
 *
 * To run a mutation, you first call `useInviteToHomeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useInviteToHomeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [inviteToHomeMutation, { data, loading, error }] = useInviteToHomeMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useInviteToHomeMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    InviteToHomeMutation,
    InviteToHomeMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    InviteToHomeMutation,
    InviteToHomeMutationVariables
  >(InviteToHomeDocument, options);
}
export type InviteToHomeMutationHookResult = ReturnType<
  typeof useInviteToHomeMutation
>;
export type InviteToHomeMutationResult =
  ApolloReactCommon.MutationResult<InviteToHomeMutation>;
export type InviteToHomeMutationOptions = ApolloReactCommon.BaseMutationOptions<
  InviteToHomeMutation,
  InviteToHomeMutationVariables
>;
export const AcceptHomeInviteDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'AcceptHomeInvite' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'token' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'String' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'acceptHomeInvite' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'token' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'token' },
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
                  name: { kind: 'Name', value: 'membership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'MemberShipFragment' },
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
      name: { kind: 'Name', value: 'MemberShipFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Membership' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UserSummary' },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canManageHome' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canViewPantry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canEditPantry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canRemoveItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canInviteOthers' } },
        ],
      },
    },
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
} as unknown as DocumentNode;

/**
 * __useAcceptHomeInviteMutation__
 *
 * To run a mutation, you first call `useAcceptHomeInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAcceptHomeInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [acceptHomeInviteMutation, { data, loading, error }] = useAcceptHomeInviteMutation({
 *   variables: {
 *      token: // value for 'token'
 *   },
 * });
 */
export function useAcceptHomeInviteMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    AcceptHomeInviteMutation,
    AcceptHomeInviteMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    AcceptHomeInviteMutation,
    AcceptHomeInviteMutationVariables
  >(AcceptHomeInviteDocument, options);
}
export type AcceptHomeInviteMutationHookResult = ReturnType<
  typeof useAcceptHomeInviteMutation
>;
export type AcceptHomeInviteMutationResult =
  ApolloReactCommon.MutationResult<AcceptHomeInviteMutation>;
export type AcceptHomeInviteMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    AcceptHomeInviteMutation,
    AcceptHomeInviteMutationVariables
  >;
export const DeclineHomeInviteDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeclineHomeInvite' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'token' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'String' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'declineHomeInvite' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'token' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'token' },
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
                  name: { kind: 'Name', value: 'homeInvite' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
 * __useDeclineHomeInviteMutation__
 *
 * To run a mutation, you first call `useDeclineHomeInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeclineHomeInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [declineHomeInviteMutation, { data, loading, error }] = useDeclineHomeInviteMutation({
 *   variables: {
 *      token: // value for 'token'
 *   },
 * });
 */
export function useDeclineHomeInviteMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    DeclineHomeInviteMutation,
    DeclineHomeInviteMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    DeclineHomeInviteMutation,
    DeclineHomeInviteMutationVariables
  >(DeclineHomeInviteDocument, options);
}
export type DeclineHomeInviteMutationHookResult = ReturnType<
  typeof useDeclineHomeInviteMutation
>;
export type DeclineHomeInviteMutationResult =
  ApolloReactCommon.MutationResult<DeclineHomeInviteMutation>;
export type DeclineHomeInviteMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    DeclineHomeInviteMutation,
    DeclineHomeInviteMutationVariables
  >;
export const UpdateMembershipDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateMembership' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
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
              name: { kind: 'Name', value: 'UpdateMembershipInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateMembership' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
                },
              },
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
                  name: { kind: 'Name', value: 'membership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'MemberShipFragment' },
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
      name: { kind: 'Name', value: 'MemberShipFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Membership' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UserSummary' },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canManageHome' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canViewPantry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canEditPantry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canRemoveItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canInviteOthers' } },
        ],
      },
    },
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
} as unknown as DocumentNode;

/**
 * __useUpdateMembershipMutation__
 *
 * To run a mutation, you first call `useUpdateMembershipMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateMembershipMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateMembershipMutation, { data, loading, error }] = useUpdateMembershipMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateMembershipMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateMembershipMutation,
    UpdateMembershipMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateMembershipMutation,
    UpdateMembershipMutationVariables
  >(UpdateMembershipDocument, options);
}
export type UpdateMembershipMutationHookResult = ReturnType<
  typeof useUpdateMembershipMutation
>;
export type UpdateMembershipMutationResult =
  ApolloReactCommon.MutationResult<UpdateMembershipMutation>;
export type UpdateMembershipMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateMembershipMutation,
    UpdateMembershipMutationVariables
  >;
export const RemoveMemberDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'RemoveMember' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
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
            name: { kind: 'Name', value: 'removeMember' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'membershipId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
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
                  name: { kind: 'Name', value: 'membership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
 * __useRemoveMemberMutation__
 *
 * To run a mutation, you first call `useRemoveMemberMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveMemberMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeMemberMutation, { data, loading, error }] = useRemoveMemberMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRemoveMemberMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    RemoveMemberMutation,
    RemoveMemberMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    RemoveMemberMutation,
    RemoveMemberMutationVariables
  >(RemoveMemberDocument, options);
}
export type RemoveMemberMutationHookResult = ReturnType<
  typeof useRemoveMemberMutation
>;
export type RemoveMemberMutationResult =
  ApolloReactCommon.MutationResult<RemoveMemberMutation>;
export type RemoveMemberMutationOptions = ApolloReactCommon.BaseMutationOptions<
  RemoveMemberMutation,
  RemoveMemberMutationVariables
>;
export const RevokeHomeInviteDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'RevokeHomeInvite' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
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
            name: { kind: 'Name', value: 'revokeHomeInvite' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'id' },
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
                  name: { kind: 'Name', value: 'homeInvite' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
 * __useRevokeHomeInviteMutation__
 *
 * To run a mutation, you first call `useRevokeHomeInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRevokeHomeInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [revokeHomeInviteMutation, { data, loading, error }] = useRevokeHomeInviteMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useRevokeHomeInviteMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    RevokeHomeInviteMutation,
    RevokeHomeInviteMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    RevokeHomeInviteMutation,
    RevokeHomeInviteMutationVariables
  >(RevokeHomeInviteDocument, options);
}
export type RevokeHomeInviteMutationHookResult = ReturnType<
  typeof useRevokeHomeInviteMutation
>;
export type RevokeHomeInviteMutationResult =
  ApolloReactCommon.MutationResult<RevokeHomeInviteMutation>;
export type RevokeHomeInviteMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    RevokeHomeInviteMutation,
    RevokeHomeInviteMutationVariables
  >;
export const JoinHomeByCodeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'JoinHomeByCode' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'joinCode' },
          },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'String' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'joinHomeByCode' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'joinCode' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'joinCode' },
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
                  name: { kind: 'Name', value: 'membership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'MemberShipFragment' },
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
      name: { kind: 'Name', value: 'MemberShipFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'Membership' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'user' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UserSummary' },
                },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'displayName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canManageHome' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canViewPantry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canEditPantry' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canAddItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canRemoveItems' } },
          { kind: 'Field', name: { kind: 'Name', value: 'canInviteOthers' } },
        ],
      },
    },
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
} as unknown as DocumentNode;

/**
 * __useJoinHomeByCodeMutation__
 *
 * To run a mutation, you first call `useJoinHomeByCodeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useJoinHomeByCodeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [joinHomeByCodeMutation, { data, loading, error }] = useJoinHomeByCodeMutation({
 *   variables: {
 *      joinCode: // value for 'joinCode'
 *   },
 * });
 */
export function useJoinHomeByCodeMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    JoinHomeByCodeMutation,
    JoinHomeByCodeMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    JoinHomeByCodeMutation,
    JoinHomeByCodeMutationVariables
  >(JoinHomeByCodeDocument, options);
}
export type JoinHomeByCodeMutationHookResult = ReturnType<
  typeof useJoinHomeByCodeMutation
>;
export type JoinHomeByCodeMutationResult =
  ApolloReactCommon.MutationResult<JoinHomeByCodeMutation>;
export type JoinHomeByCodeMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    JoinHomeByCodeMutation,
    JoinHomeByCodeMutationVariables
  >;
export const LeaveHomeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'LeaveHome' },
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
            name: { kind: 'Name', value: 'leaveHome' },
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
                  name: { kind: 'Name', value: 'membership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
 * __useLeaveHomeMutation__
 *
 * To run a mutation, you first call `useLeaveHomeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useLeaveHomeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [leaveHomeMutation, { data, loading, error }] = useLeaveHomeMutation({
 *   variables: {
 *      homeId: // value for 'homeId'
 *   },
 * });
 */
export function useLeaveHomeMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    LeaveHomeMutation,
    LeaveHomeMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    LeaveHomeMutation,
    LeaveHomeMutationVariables
  >(LeaveHomeDocument, options);
}
export type LeaveHomeMutationHookResult = ReturnType<
  typeof useLeaveHomeMutation
>;
export type LeaveHomeMutationResult =
  ApolloReactCommon.MutationResult<LeaveHomeMutation>;
export type LeaveHomeMutationOptions = ApolloReactCommon.BaseMutationOptions<
  LeaveHomeMutation,
  LeaveHomeMutationVariables
>;
export const HomeInviteChangedDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'HomeInviteChanged' },
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
            name: { kind: 'Name', value: 'homeInviteChanged' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'mutation' } },
                { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'homeInvite' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'HomeInviteFragment' },
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
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'HomeInviteFragment' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'HomeInvite' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'token' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'invitedUserId' } },
          { kind: 'Field', name: { kind: 'Name', value: 'recipientName' } },
          { kind: 'Field', name: { kind: 'Name', value: 'role' } },
          { kind: 'Field', name: { kind: 'Name', value: 'status' } },
          { kind: 'Field', name: { kind: 'Name', value: 'expiresAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'sentAt' } },
          { kind: 'Field', name: { kind: 'Name', value: 'message' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'home' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'inviter' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BasicUser' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'profile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
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
      name: { kind: 'Name', value: 'BasicUser' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'User' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useHomeInviteChangedSubscription__
 *
 * To run a query within a React component, call `useHomeInviteChangedSubscription` and pass it any options that fit your needs.
 * When your component renders, `useHomeInviteChangedSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useHomeInviteChangedSubscription({
 *   variables: {
 *      homeId: // value for 'homeId'
 *   },
 * });
 */
export function useHomeInviteChangedSubscription(
  baseOptions: ApolloReactHooks.SubscriptionHookOptions<
    HomeInviteChangedSubscription,
    HomeInviteChangedSubscriptionVariables
  > &
    (
      | { variables: HomeInviteChangedSubscriptionVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    HomeInviteChangedSubscription,
    HomeInviteChangedSubscriptionVariables
  >(HomeInviteChangedDocument, options);
}
export type HomeInviteChangedSubscriptionHookResult = ReturnType<
  typeof useHomeInviteChangedSubscription
>;
export type HomeInviteChangedSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<HomeInviteChangedSubscription>;
