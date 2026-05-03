// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type { ShoppingListCollaboratorFragment } from '../../../graphql/operations/fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type MyShoppingListInvitesQueryVariables = Types.Exact<{ [key: string]: never; }>;


export type MyShoppingListInvitesQuery = { __typename: 'Query', me: { __typename: 'User', id: string, pendingCollaborationInvites: Array<{ __typename: 'ShoppingListCollaborator', id: string, token: string | null, shoppingListId: string, collaboratorId: string | null, email: string | null, role: Types.CollaboratorRole, status: Types.CollaboratorStatus, canEdit: boolean, canAddItems: boolean, canRemoveItems: boolean, canMarkPurchased: boolean, canInviteOthers: boolean, invitedAt: string, expiresAt: string | null, shoppingList: { __typename: 'ShoppingList', id: string, name: string, description: string | null }, collaborator: { __typename: 'User', id: string, email: string, profile: { __typename: 'UserProfile', id: string, displayName: string | null, avatar: string | null } | null } | null, invitedBy: { __typename: 'User', id: string, email: string, profile: { __typename: 'UserProfile', id: string, displayName: string | null } | null } | null }> } | null };

export type AcceptShoppingListInviteMutationVariables = Types.Exact<{
  token: Types.Scalars['String']['input'];
}>;


export type AcceptShoppingListInviteMutation = { __typename: 'Mutation', acceptShoppingListInvite: { __typename: 'ShoppingListCollaboratorPayload', success: boolean, message: string, code: string, collaborator: (
      { __typename: 'ShoppingListCollaborator', canEdit: boolean, canInviteOthers: boolean, invitedAt: string, shoppingList: { __typename: 'ShoppingList', id: string, name: string, description: string | null } }
      & ShoppingListCollaboratorFragment
    ) | null } };

export type DeclineShoppingListInviteMutationVariables = Types.Exact<{
  token: Types.Scalars['String']['input'];
}>;


export type DeclineShoppingListInviteMutation = { __typename: 'Mutation', declineShoppingListInvite: { __typename: 'ShoppingListCollaboratorPayload', success: boolean, message: string, code: string, collaborator: { __typename: 'ShoppingListCollaborator', id: string } | null } };

export type CollaborationChangesSubscriptionVariables = Types.Exact<{
  listId: Types.Scalars['ID']['input'];
}>;


export type CollaborationChangesSubscription = { __typename: 'Subscription', collaborationChanged: { __typename: 'CollaborationChangeEvent', mutation: Types.MutationType, listId: string, timestamp: string, userId: string, collaborator: (
      { __typename: 'ShoppingListCollaborator', canEdit: boolean, invitedAt: string, lastViewedAt: string | null }
      & ShoppingListCollaboratorFragment
    ) } };


export const MyShoppingListInvitesDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MyShoppingListInvites"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"me"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"pendingCollaborationInvites"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"token"}},{"kind":"Field","name":{"kind":"Name","value":"shoppingListId"}},{"kind":"Field","name":{"kind":"Name","value":"collaboratorId"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"canAddItems"}},{"kind":"Field","name":{"kind":"Name","value":"canRemoveItems"}},{"kind":"Field","name":{"kind":"Name","value":"canMarkPurchased"}},{"kind":"Field","name":{"kind":"Name","value":"canInviteOthers"}},{"kind":"Field","name":{"kind":"Name","value":"invitedAt"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"shoppingList"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}},{"kind":"Field","name":{"kind":"Name","value":"collaborator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"invitedBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useMyShoppingListInvitesQuery__
 *
 * To run a query within a React component, call `useMyShoppingListInvitesQuery` and pass it any options that fit your needs.
 * When your component renders, `useMyShoppingListInvitesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useMyShoppingListInvitesQuery({
 *   variables: {
 *   },
 * });
 */
export function useMyShoppingListInvitesQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>(MyShoppingListInvitesDocument, options);
      }
export function useMyShoppingListInvitesLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>(MyShoppingListInvitesDocument, options);
        }
// @ts-ignore
export function useMyShoppingListInvitesSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>;
export function useMyShoppingListInvitesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<MyShoppingListInvitesQuery | undefined, MyShoppingListInvitesQueryVariables>;
export function useMyShoppingListInvitesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>(MyShoppingListInvitesDocument, options);
        }
export type MyShoppingListInvitesQueryHookResult = ReturnType<typeof useMyShoppingListInvitesQuery>;
export type MyShoppingListInvitesLazyQueryHookResult = ReturnType<typeof useMyShoppingListInvitesLazyQuery>;
export type MyShoppingListInvitesSuspenseQueryHookResult = ReturnType<typeof useMyShoppingListInvitesSuspenseQuery>;
export type MyShoppingListInvitesQueryResult = ApolloReactCommon.QueryResult<MyShoppingListInvitesQuery, MyShoppingListInvitesQueryVariables>;
export const AcceptShoppingListInviteDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AcceptShoppingListInvite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"acceptShoppingListInvite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"collaborator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShoppingListCollaboratorFragment"}},{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"canInviteOthers"}},{"kind":"Field","name":{"kind":"Name","value":"invitedAt"}},{"kind":"Field","name":{"kind":"Name","value":"shoppingList"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShoppingListCollaboratorFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShoppingListCollaborator"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"collaboratorId"}},{"kind":"Field","name":{"kind":"Name","value":"canAddItems"}},{"kind":"Field","name":{"kind":"Name","value":"canRemoveItems"}},{"kind":"Field","name":{"kind":"Name","value":"canEditItems"}},{"kind":"Field","name":{"kind":"Name","value":"canMarkPurchased"}},{"kind":"Field","name":{"kind":"Name","value":"collaborator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useAcceptShoppingListInviteMutation__
 *
 * To run a mutation, you first call `useAcceptShoppingListInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAcceptShoppingListInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [acceptShoppingListInviteMutation, { data, loading, error }] = useAcceptShoppingListInviteMutation({
 *   variables: {
 *      token: // value for 'token'
 *   },
 * });
 */
export function useAcceptShoppingListInviteMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<AcceptShoppingListInviteMutation, AcceptShoppingListInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<AcceptShoppingListInviteMutation, AcceptShoppingListInviteMutationVariables>(AcceptShoppingListInviteDocument, options);
      }
export type AcceptShoppingListInviteMutationHookResult = ReturnType<typeof useAcceptShoppingListInviteMutation>;
export type AcceptShoppingListInviteMutationResult = ApolloReactCommon.MutationResult<AcceptShoppingListInviteMutation>;
export type AcceptShoppingListInviteMutationOptions = ApolloReactCommon.BaseMutationOptions<AcceptShoppingListInviteMutation, AcceptShoppingListInviteMutationVariables>;
export const DeclineShoppingListInviteDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeclineShoppingListInvite"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"declineShoppingListInvite"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"collaborator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useDeclineShoppingListInviteMutation__
 *
 * To run a mutation, you first call `useDeclineShoppingListInviteMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeclineShoppingListInviteMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [declineShoppingListInviteMutation, { data, loading, error }] = useDeclineShoppingListInviteMutation({
 *   variables: {
 *      token: // value for 'token'
 *   },
 * });
 */
export function useDeclineShoppingListInviteMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DeclineShoppingListInviteMutation, DeclineShoppingListInviteMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DeclineShoppingListInviteMutation, DeclineShoppingListInviteMutationVariables>(DeclineShoppingListInviteDocument, options);
      }
export type DeclineShoppingListInviteMutationHookResult = ReturnType<typeof useDeclineShoppingListInviteMutation>;
export type DeclineShoppingListInviteMutationResult = ApolloReactCommon.MutationResult<DeclineShoppingListInviteMutation>;
export type DeclineShoppingListInviteMutationOptions = ApolloReactCommon.BaseMutationOptions<DeclineShoppingListInviteMutation, DeclineShoppingListInviteMutationVariables>;
export const CollaborationChangesDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"subscription","name":{"kind":"Name","value":"CollaborationChanges"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"listId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"collaborationChanged"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"listId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"listId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mutation"}},{"kind":"Field","name":{"kind":"Name","value":"collaborator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ShoppingListCollaboratorFragment"}},{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"invitedAt"}},{"kind":"Field","name":{"kind":"Name","value":"lastViewedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"listId"}},{"kind":"Field","name":{"kind":"Name","value":"timestamp"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ShoppingListCollaboratorFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ShoppingListCollaborator"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"role"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"collaboratorId"}},{"kind":"Field","name":{"kind":"Name","value":"canAddItems"}},{"kind":"Field","name":{"kind":"Name","value":"canRemoveItems"}},{"kind":"Field","name":{"kind":"Name","value":"canEditItems"}},{"kind":"Field","name":{"kind":"Name","value":"canMarkPurchased"}},{"kind":"Field","name":{"kind":"Name","value":"collaborator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useCollaborationChangesSubscription__
 *
 * To run a query within a React component, call `useCollaborationChangesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useCollaborationChangesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCollaborationChangesSubscription({
 *   variables: {
 *      listId: // value for 'listId'
 *   },
 * });
 */
export function useCollaborationChangesSubscription(baseOptions: ApolloReactHooks.SubscriptionHookOptions<CollaborationChangesSubscription, CollaborationChangesSubscriptionVariables> & ({ variables: CollaborationChangesSubscriptionVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useSubscription<CollaborationChangesSubscription, CollaborationChangesSubscriptionVariables>(CollaborationChangesDocument, options);
      }
export type CollaborationChangesSubscriptionHookResult = ReturnType<typeof useCollaborationChangesSubscription>;
export type CollaborationChangesSubscriptionResult = ApolloReactCommon.SubscriptionResult<CollaborationChangesSubscription>;