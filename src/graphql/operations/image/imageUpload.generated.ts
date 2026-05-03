// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type CreateImageUploadUrlMutationVariables = Types.Exact<{
  mime: Types.Scalars['String']['input'];
  purpose: Types.ImageUploadPurpose;
  itemId?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type CreateImageUploadUrlMutation = { __typename: 'Mutation', createImageUploadUrl: { __typename: 'PresignPayload', url: string, key: string } };

export type ConfirmProfileImageUploadMutationVariables = Types.Exact<{
  key: Types.Scalars['String']['input'];
}>;


export type ConfirmProfileImageUploadMutation = { __typename: 'Mutation', confirmProfileImageUpload: { __typename: 'UploadPayload', success: boolean, message: string, code: string, url: string | null } };

export type ConfirmItemImageUploadMutationVariables = Types.Exact<{
  itemId: Types.Scalars['String']['input'];
  key: Types.Scalars['String']['input'];
}>;


export type ConfirmItemImageUploadMutation = { __typename: 'Mutation', confirmItemImageUpload: { __typename: 'UploadPayload', success: boolean, message: string, code: string, url: string | null } };

export type UpdateItemImageMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  imageUrl: Types.Scalars['String']['input'];
}>;


export type UpdateItemImageMutation = { __typename: 'Mutation', updateItem: { __typename: 'ItemPayload', success: boolean, message: string, code: string, item: { __typename: 'Item', id: string, imageUrl: string | null } | null } };


export const CreateImageUploadUrlDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateImageUploadUrl"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mime"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"purpose"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ImageUploadPurpose"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"itemId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createImageUploadUrl"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"mime"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mime"}}},{"kind":"Argument","name":{"kind":"Name","value":"purpose"},"value":{"kind":"Variable","name":{"kind":"Name","value":"purpose"}}},{"kind":"Argument","name":{"kind":"Name","value":"itemId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"itemId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"key"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateImageUploadUrlMutation__
 *
 * To run a mutation, you first call `useCreateImageUploadUrlMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateImageUploadUrlMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createImageUploadUrlMutation, { data, loading, error }] = useCreateImageUploadUrlMutation({
 *   variables: {
 *      mime: // value for 'mime'
 *      purpose: // value for 'purpose'
 *      itemId: // value for 'itemId'
 *   },
 * });
 */
export function useCreateImageUploadUrlMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateImageUploadUrlMutation, CreateImageUploadUrlMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateImageUploadUrlMutation, CreateImageUploadUrlMutationVariables>(CreateImageUploadUrlDocument, options);
      }
export type CreateImageUploadUrlMutationHookResult = ReturnType<typeof useCreateImageUploadUrlMutation>;
export type CreateImageUploadUrlMutationResult = ApolloReactCommon.MutationResult<CreateImageUploadUrlMutation>;
export type CreateImageUploadUrlMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateImageUploadUrlMutation, CreateImageUploadUrlMutationVariables>;
export const ConfirmProfileImageUploadDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmProfileImageUpload"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmProfileImageUpload"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useConfirmProfileImageUploadMutation__
 *
 * To run a mutation, you first call `useConfirmProfileImageUploadMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useConfirmProfileImageUploadMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [confirmProfileImageUploadMutation, { data, loading, error }] = useConfirmProfileImageUploadMutation({
 *   variables: {
 *      key: // value for 'key'
 *   },
 * });
 */
export function useConfirmProfileImageUploadMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<ConfirmProfileImageUploadMutation, ConfirmProfileImageUploadMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<ConfirmProfileImageUploadMutation, ConfirmProfileImageUploadMutationVariables>(ConfirmProfileImageUploadDocument, options);
      }
export type ConfirmProfileImageUploadMutationHookResult = ReturnType<typeof useConfirmProfileImageUploadMutation>;
export type ConfirmProfileImageUploadMutationResult = ApolloReactCommon.MutationResult<ConfirmProfileImageUploadMutation>;
export type ConfirmProfileImageUploadMutationOptions = ApolloReactCommon.BaseMutationOptions<ConfirmProfileImageUploadMutation, ConfirmProfileImageUploadMutationVariables>;
export const ConfirmItemImageUploadDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ConfirmItemImageUpload"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"itemId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"key"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"confirmItemImageUpload"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"itemId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"itemId"}}},{"kind":"Argument","name":{"kind":"Name","value":"key"},"value":{"kind":"Variable","name":{"kind":"Name","value":"key"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useConfirmItemImageUploadMutation__
 *
 * To run a mutation, you first call `useConfirmItemImageUploadMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useConfirmItemImageUploadMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [confirmItemImageUploadMutation, { data, loading, error }] = useConfirmItemImageUploadMutation({
 *   variables: {
 *      itemId: // value for 'itemId'
 *      key: // value for 'key'
 *   },
 * });
 */
export function useConfirmItemImageUploadMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<ConfirmItemImageUploadMutation, ConfirmItemImageUploadMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<ConfirmItemImageUploadMutation, ConfirmItemImageUploadMutationVariables>(ConfirmItemImageUploadDocument, options);
      }
export type ConfirmItemImageUploadMutationHookResult = ReturnType<typeof useConfirmItemImageUploadMutation>;
export type ConfirmItemImageUploadMutationResult = ApolloReactCommon.MutationResult<ConfirmItemImageUploadMutation>;
export type ConfirmItemImageUploadMutationOptions = ApolloReactCommon.BaseMutationOptions<ConfirmItemImageUploadMutation, ConfirmItemImageUploadMutationVariables>;
export const UpdateItemImageDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateItemImage"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"imageUrl"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateItem"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"media"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"imageUrl"},"value":{"kind":"Variable","name":{"kind":"Name","value":"imageUrl"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"item"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useUpdateItemImageMutation__
 *
 * To run a mutation, you first call `useUpdateItemImageMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateItemImageMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateItemImageMutation, { data, loading, error }] = useUpdateItemImageMutation({
 *   variables: {
 *      id: // value for 'id'
 *      imageUrl: // value for 'imageUrl'
 *   },
 * });
 */
export function useUpdateItemImageMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UpdateItemImageMutation, UpdateItemImageMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UpdateItemImageMutation, UpdateItemImageMutationVariables>(UpdateItemImageDocument, options);
      }
export type UpdateItemImageMutationHookResult = ReturnType<typeof useUpdateItemImageMutation>;
export type UpdateItemImageMutationResult = ApolloReactCommon.MutationResult<UpdateItemImageMutation>;
export type UpdateItemImageMutationOptions = ApolloReactCommon.BaseMutationOptions<UpdateItemImageMutation, UpdateItemImageMutationVariables>;