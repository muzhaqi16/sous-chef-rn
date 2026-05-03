// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type SetDefaultHomeMutationVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
}>;


export type SetDefaultHomeMutation = { __typename: 'Mutation', setDefaultHome: { __typename: 'SetDefaultHomePayload', success: boolean, message: string, code: string, settings: { __typename: 'UserSettings', id: string } | null, defaultPantry: { __typename: 'Pantry', id: string, name: string, isDefault: boolean } | null } };


export const SetDefaultHomeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetDefaultHome"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"homeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setDefaultHome"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"homeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"homeId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"settings"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"defaultPantry"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useSetDefaultHomeMutation__
 *
 * To run a mutation, you first call `useSetDefaultHomeMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSetDefaultHomeMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [setDefaultHomeMutation, { data, loading, error }] = useSetDefaultHomeMutation({
 *   variables: {
 *      homeId: // value for 'homeId'
 *   },
 * });
 */
export function useSetDefaultHomeMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<SetDefaultHomeMutation, SetDefaultHomeMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<SetDefaultHomeMutation, SetDefaultHomeMutationVariables>(SetDefaultHomeDocument, options);
      }
export type SetDefaultHomeMutationHookResult = ReturnType<typeof useSetDefaultHomeMutation>;
export type SetDefaultHomeMutationResult = ApolloReactCommon.MutationResult<SetDefaultHomeMutation>;
export type SetDefaultHomeMutationOptions = ApolloReactCommon.BaseMutationOptions<SetDefaultHomeMutation, SetDefaultHomeMutationVariables>;