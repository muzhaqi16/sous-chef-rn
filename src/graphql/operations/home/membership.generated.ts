// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type MembershipChangesSubscriptionVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
}>;

export type MembershipChangesSubscription = {
  __typename: 'Subscription';
  membershipChanged: {
    __typename: 'MembershipChangeEvent';
    changeType: Types.MembershipChangeType;
    homeId: string;
    previousRole: Types.MembershipRole | null;
    newRole: Types.MembershipRole | null;
    userId: string;
    timestamp: string;
    membership: {
      __typename: 'Membership';
      id: string;
      homeId: string;
      userId: string;
      role: Types.MembershipRole;
      status: Types.MembershipStatus;
      displayName: string | null;
      canViewPantry: boolean;
      canEditPantry: boolean;
      canAddItems: boolean;
      canRemoveItems: boolean;
      canInviteOthers: boolean;
      canManageHome: boolean;
      lastActiveAt: string | null;
      joinedAt: string;
      home: {
        __typename: 'Home';
        id: string;
        name: string;
        type: Types.HomeType;
      };
      user: {
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
    };
  };
};

export const MembershipChangesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'MembershipChanges' },
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
            name: { kind: 'Name', value: 'membershipChanged' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'changeType' } },
                { kind: 'Field', name: { kind: 'Name', value: 'homeId' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'membership' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'homeId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'userId' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
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
                        name: { kind: 'Name', value: 'canViewPantry' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'canEditPantry' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'canAddItems' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'canRemoveItems' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'canInviteOthers' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'canManageHome' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastActiveAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'joinedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'home' },
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
                              name: { kind: 'Name', value: 'type' },
                            },
                          ],
                        },
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
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'profile' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'id' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'displayName',
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'avatar' },
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
                  name: { kind: 'Name', value: 'previousRole' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'newRole' } },
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
 * __useMembershipChangesSubscription__
 *
 * To run a query within a React component, call `useMembershipChangesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useMembershipChangesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMembershipChangesSubscription({
 *   variables: {
 *      homeId: // value for 'homeId'
 *   },
 * });
 */
export function useMembershipChangesSubscription(
  baseOptions: ApolloReactHooks.SubscriptionHookOptions<
    MembershipChangesSubscription,
    MembershipChangesSubscriptionVariables
  > &
    (
      | { variables: MembershipChangesSubscriptionVariables; skip?: boolean }
      | { skip: boolean }
    ),
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    MembershipChangesSubscription,
    MembershipChangesSubscriptionVariables
  >(MembershipChangesDocument, options);
}
export type MembershipChangesSubscriptionHookResult = ReturnType<
  typeof useMembershipChangesSubscription
>;
export type MembershipChangesSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<MembershipChangesSubscription>;
