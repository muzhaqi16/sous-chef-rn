// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type { RecipeReviewFragment } from '../../../graphql/operations/fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type CreateRecipeReviewMutationVariables = Types.Exact<{
  input: Types.CreateRecipeReviewInput;
}>;


export type CreateRecipeReviewMutation = { __typename: 'Mutation', createRecipeReview: { __typename: 'RecipeReviewPayload', success: boolean, code: string, message: string, recipeReview: (
      { __typename: 'RecipeReview' }
      & RecipeReviewFragment
    ) | null } };

export type UpdateRecipeReviewMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateRecipeReviewInput;
}>;


export type UpdateRecipeReviewMutation = { __typename: 'Mutation', updateRecipeReview: { __typename: 'RecipeReviewPayload', success: boolean, code: string, message: string, recipeReview: (
      { __typename: 'RecipeReview' }
      & RecipeReviewFragment
    ) | null } };

export type DeleteRecipeReviewMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteRecipeReviewMutation = { __typename: 'Mutation', deleteRecipeReview: { __typename: 'RecipeReviewPayload', success: boolean, code: string, message: string } };

export type ToggleReviewHelpfulMutationVariables = Types.Exact<{
  input: Types.ToggleReviewHelpfulInput;
}>;


export type ToggleReviewHelpfulMutation = { __typename: 'Mutation', toggleReviewHelpful: { __typename: 'ReviewHelpfulPayload', success: boolean, code: string, message: string, reviewHelpful: { __typename: 'ReviewHelpful', id: string, user: { __typename: 'User', id: string } } | null } };


export const CreateRecipeReviewDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRecipeReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateRecipeReviewInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRecipeReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"recipeReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RecipeReviewFragment"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RecipeReviewFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecipeReview"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"helpful"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserSummary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"helpfulVotes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateRecipeReviewMutation__
 *
 * To run a mutation, you first call `useCreateRecipeReviewMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateRecipeReviewMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createRecipeReviewMutation, { data, loading, error }] = useCreateRecipeReviewMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateRecipeReviewMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateRecipeReviewMutation, CreateRecipeReviewMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateRecipeReviewMutation, CreateRecipeReviewMutationVariables>(CreateRecipeReviewDocument, options);
      }
export type CreateRecipeReviewMutationHookResult = ReturnType<typeof useCreateRecipeReviewMutation>;
export type CreateRecipeReviewMutationResult = ApolloReactCommon.MutationResult<CreateRecipeReviewMutation>;
export type CreateRecipeReviewMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateRecipeReviewMutation, CreateRecipeReviewMutationVariables>;
export const UpdateRecipeReviewDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateRecipeReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateRecipeReviewInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateRecipeReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"recipeReview"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RecipeReviewFragment"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RecipeReviewFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RecipeReview"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"rating"}},{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"helpful"}},{"kind":"Field","name":{"kind":"Name","value":"verified"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"UserSummary"}}]}},{"kind":"Field","name":{"kind":"Name","value":"helpfulVotes"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"UserSummary"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useUpdateRecipeReviewMutation__
 *
 * To run a mutation, you first call `useUpdateRecipeReviewMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateRecipeReviewMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateRecipeReviewMutation, { data, loading, error }] = useUpdateRecipeReviewMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateRecipeReviewMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UpdateRecipeReviewMutation, UpdateRecipeReviewMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UpdateRecipeReviewMutation, UpdateRecipeReviewMutationVariables>(UpdateRecipeReviewDocument, options);
      }
export type UpdateRecipeReviewMutationHookResult = ReturnType<typeof useUpdateRecipeReviewMutation>;
export type UpdateRecipeReviewMutationResult = ApolloReactCommon.MutationResult<UpdateRecipeReviewMutation>;
export type UpdateRecipeReviewMutationOptions = ApolloReactCommon.BaseMutationOptions<UpdateRecipeReviewMutation, UpdateRecipeReviewMutationVariables>;
export const DeleteRecipeReviewDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteRecipeReview"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteRecipeReview"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useDeleteRecipeReviewMutation__
 *
 * To run a mutation, you first call `useDeleteRecipeReviewMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteRecipeReviewMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteRecipeReviewMutation, { data, loading, error }] = useDeleteRecipeReviewMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteRecipeReviewMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DeleteRecipeReviewMutation, DeleteRecipeReviewMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DeleteRecipeReviewMutation, DeleteRecipeReviewMutationVariables>(DeleteRecipeReviewDocument, options);
      }
export type DeleteRecipeReviewMutationHookResult = ReturnType<typeof useDeleteRecipeReviewMutation>;
export type DeleteRecipeReviewMutationResult = ApolloReactCommon.MutationResult<DeleteRecipeReviewMutation>;
export type DeleteRecipeReviewMutationOptions = ApolloReactCommon.BaseMutationOptions<DeleteRecipeReviewMutation, DeleteRecipeReviewMutationVariables>;
export const ToggleReviewHelpfulDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ToggleReviewHelpful"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ToggleReviewHelpfulInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"toggleReviewHelpful"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"reviewHelpful"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useToggleReviewHelpfulMutation__
 *
 * To run a mutation, you first call `useToggleReviewHelpfulMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useToggleReviewHelpfulMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [toggleReviewHelpfulMutation, { data, loading, error }] = useToggleReviewHelpfulMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useToggleReviewHelpfulMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<ToggleReviewHelpfulMutation, ToggleReviewHelpfulMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<ToggleReviewHelpfulMutation, ToggleReviewHelpfulMutationVariables>(ToggleReviewHelpfulDocument, options);
      }
export type ToggleReviewHelpfulMutationHookResult = ReturnType<typeof useToggleReviewHelpfulMutation>;
export type ToggleReviewHelpfulMutationResult = ApolloReactCommon.MutationResult<ToggleReviewHelpfulMutation>;
export type ToggleReviewHelpfulMutationOptions = ApolloReactCommon.BaseMutationOptions<ToggleReviewHelpfulMutation, ToggleReviewHelpfulMutationVariables>;