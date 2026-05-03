// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type { MealTemplateDisplayFragment, MealTemplateItemFragment, MealPlanFullFragment } from '../../../graphql/operations/fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetMealTemplatesQueryVariables = Types.Exact<{
  filters?: Types.InputMaybe<Types.MealTemplateFilters>;
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  orderBy?: Types.InputMaybe<Types.MealTemplateOrderBy>;
}>;


export type GetMealTemplatesQuery = { __typename: 'Query', mealTemplates: { __typename: 'MealTemplateConnection', totalCount: number | null, edges: Array<{ __typename: 'MealTemplateEdge', cursor: string, node: (
        { __typename: 'MealTemplate' }
        & MealTemplateDisplayFragment
      ) }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type GetMealTemplateQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetMealTemplateQuery = { __typename: 'Query', mealTemplate: (
    { __typename: 'MealTemplate', items: Array<(
      { __typename: 'MealTemplateItem' }
      & MealTemplateItemFragment
    )> }
    & MealTemplateDisplayFragment
  ) | null };

export type DeleteMealTemplateMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteMealTemplateMutation = { __typename: 'Mutation', deleteMealTemplate: { __typename: 'MealTemplatePayload', success: boolean, message: string, code: string, mealTemplate: { __typename: 'MealTemplate', id: string, name: string } | null } };

export type DuplicateTemplateMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  newName: Types.Scalars['String']['input'];
}>;


export type DuplicateTemplateMutation = { __typename: 'Mutation', duplicateTemplate: { __typename: 'MealTemplatePayload', success: boolean, message: string, code: string, mealTemplate: (
      { __typename: 'MealTemplate', items: Array<(
        { __typename: 'MealTemplateItem' }
        & MealTemplateItemFragment
      )> }
      & MealTemplateDisplayFragment
    ) | null } };

export type CreateMealPlanFromTemplateMutationVariables = Types.Exact<{
  input: Types.CreateMealPlanFromTemplateInput;
}>;


export type CreateMealPlanFromTemplateMutation = { __typename: 'Mutation', createMealPlanFromTemplate: { __typename: 'MealPlanPayload', success: boolean, message: string, code: string, mealPlan: (
      { __typename: 'MealPlan' }
      & MealPlanFullFragment
    ) | null } };

export type CreateTemplateFromMealPlanMutationVariables = Types.Exact<{
  input: Types.CreateTemplateFromMealPlanInput;
}>;


export type CreateTemplateFromMealPlanMutation = { __typename: 'Mutation', createTemplateFromMealPlan: { __typename: 'MealTemplatePayload', success: boolean, message: string, code: string, mealTemplate: (
      { __typename: 'MealTemplate', items: Array<(
        { __typename: 'MealTemplateItem' }
        & MealTemplateItemFragment
      )> }
      & MealTemplateDisplayFragment
    ) | null } };


export const GetMealTemplatesDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMealTemplates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filters"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"MealTemplateFilters"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"MealTemplateOrderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mealTemplates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealTemplateDisplay"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealTemplateDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealTemplate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"defaultServings"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"usageCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode;

/**
 * __useGetMealTemplatesQuery__
 *
 * To run a query within a React component, call `useGetMealTemplatesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetMealTemplatesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetMealTemplatesQuery({
 *   variables: {
 *      filters: // value for 'filters'
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      orderBy: // value for 'orderBy'
 *   },
 * });
 */
export function useGetMealTemplatesQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>(GetMealTemplatesDocument, options);
      }
export function useGetMealTemplatesLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>(GetMealTemplatesDocument, options);
        }
// @ts-ignore
export function useGetMealTemplatesSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>;
export function useGetMealTemplatesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetMealTemplatesQuery | undefined, GetMealTemplatesQueryVariables>;
export function useGetMealTemplatesSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>(GetMealTemplatesDocument, options);
        }
export type GetMealTemplatesQueryHookResult = ReturnType<typeof useGetMealTemplatesQuery>;
export type GetMealTemplatesLazyQueryHookResult = ReturnType<typeof useGetMealTemplatesLazyQuery>;
export type GetMealTemplatesSuspenseQueryHookResult = ReturnType<typeof useGetMealTemplatesSuspenseQuery>;
export type GetMealTemplatesQueryResult = ApolloReactCommon.QueryResult<GetMealTemplatesQuery, GetMealTemplatesQueryVariables>;
export const GetMealTemplateDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMealTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mealTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealTemplateDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealTemplateItemFragment"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealTemplateDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealTemplate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"defaultServings"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"usageCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealTemplateItemFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealTemplateItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dayOffset"}},{"kind":"Field","name":{"kind":"Name","value":"mealType"}},{"kind":"Field","name":{"kind":"Name","value":"customMealName"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanRecipeFragment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}}]}}]} as unknown as DocumentNode;

/**
 * __useGetMealTemplateQuery__
 *
 * To run a query within a React component, call `useGetMealTemplateQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetMealTemplateQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetMealTemplateQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetMealTemplateQuery(baseOptions: ApolloReactHooks.QueryHookOptions<GetMealTemplateQuery, GetMealTemplateQueryVariables> & ({ variables: GetMealTemplateQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetMealTemplateQuery, GetMealTemplateQueryVariables>(GetMealTemplateDocument, options);
      }
export function useGetMealTemplateLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetMealTemplateQuery, GetMealTemplateQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetMealTemplateQuery, GetMealTemplateQueryVariables>(GetMealTemplateDocument, options);
        }
// @ts-ignore
export function useGetMealTemplateSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetMealTemplateQuery, GetMealTemplateQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetMealTemplateQuery, GetMealTemplateQueryVariables>;
export function useGetMealTemplateSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetMealTemplateQuery, GetMealTemplateQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetMealTemplateQuery | undefined, GetMealTemplateQueryVariables>;
export function useGetMealTemplateSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetMealTemplateQuery, GetMealTemplateQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetMealTemplateQuery, GetMealTemplateQueryVariables>(GetMealTemplateDocument, options);
        }
export type GetMealTemplateQueryHookResult = ReturnType<typeof useGetMealTemplateQuery>;
export type GetMealTemplateLazyQueryHookResult = ReturnType<typeof useGetMealTemplateLazyQuery>;
export type GetMealTemplateSuspenseQueryHookResult = ReturnType<typeof useGetMealTemplateSuspenseQuery>;
export type GetMealTemplateQueryResult = ApolloReactCommon.QueryResult<GetMealTemplateQuery, GetMealTemplateQueryVariables>;
export const DeleteMealTemplateDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMealTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMealTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useDeleteMealTemplateMutation__
 *
 * To run a mutation, you first call `useDeleteMealTemplateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteMealTemplateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteMealTemplateMutation, { data, loading, error }] = useDeleteMealTemplateMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteMealTemplateMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DeleteMealTemplateMutation, DeleteMealTemplateMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DeleteMealTemplateMutation, DeleteMealTemplateMutationVariables>(DeleteMealTemplateDocument, options);
      }
export type DeleteMealTemplateMutationHookResult = ReturnType<typeof useDeleteMealTemplateMutation>;
export type DeleteMealTemplateMutationResult = ApolloReactCommon.MutationResult<DeleteMealTemplateMutation>;
export type DeleteMealTemplateMutationOptions = ApolloReactCommon.BaseMutationOptions<DeleteMealTemplateMutation, DeleteMealTemplateMutationVariables>;
export const DuplicateTemplateDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DuplicateTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"newName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"duplicateTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"newName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"newName"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealTemplateDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealTemplateItemFragment"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealTemplateDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealTemplate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"defaultServings"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"usageCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealTemplateItemFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealTemplateItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dayOffset"}},{"kind":"Field","name":{"kind":"Name","value":"mealType"}},{"kind":"Field","name":{"kind":"Name","value":"customMealName"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanRecipeFragment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}}]}}]} as unknown as DocumentNode;

/**
 * __useDuplicateTemplateMutation__
 *
 * To run a mutation, you first call `useDuplicateTemplateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDuplicateTemplateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [duplicateTemplateMutation, { data, loading, error }] = useDuplicateTemplateMutation({
 *   variables: {
 *      id: // value for 'id'
 *      newName: // value for 'newName'
 *   },
 * });
 */
export function useDuplicateTemplateMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DuplicateTemplateMutation, DuplicateTemplateMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DuplicateTemplateMutation, DuplicateTemplateMutationVariables>(DuplicateTemplateDocument, options);
      }
export type DuplicateTemplateMutationHookResult = ReturnType<typeof useDuplicateTemplateMutation>;
export type DuplicateTemplateMutationResult = ApolloReactCommon.MutationResult<DuplicateTemplateMutation>;
export type DuplicateTemplateMutationOptions = ApolloReactCommon.BaseMutationOptions<DuplicateTemplateMutation, DuplicateTemplateMutationVariables>;
export const CreateMealPlanFromTemplateDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMealPlanFromTemplate"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMealPlanFromTemplateInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMealPlanFromTemplate"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealPlan"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanFull"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanFull"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlan"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"dietaryProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"calorieTarget"}},{"kind":"Field","name":{"kind":"Name","value":"proteinTarget"}},{"kind":"Field","name":{"kind":"Name","value":"carbsTarget"}},{"kind":"Field","name":{"kind":"Name","value":"fatTarget"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mealPlanItems"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanItemFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"generatedShoppingLists"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionSummary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"avgDailyCalories"}},{"kind":"Field","name":{"kind":"Name","value":"avgDailyProtein"}},{"kind":"Field","name":{"kind":"Name","value":"avgDailyCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"avgDailyFat"}},{"kind":"Field","name":{"kind":"Name","value":"totalMeals"}},{"kind":"Field","name":{"kind":"Name","value":"mealsWithNutrition"}},{"kind":"Field","name":{"kind":"Name","value":"coveragePercentage"}},{"kind":"Field","name":{"kind":"Name","value":"mealTypeBreakdown"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mealType"}},{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"mealCount"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionGoalProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"overallScore"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"Field","name":{"kind":"Name","value":"proteinProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"Field","name":{"kind":"Name","value":"carbsProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fatProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlan"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"planType"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"budgetAmount"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanItemFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlanItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"mealType"}},{"kind":"Field","name":{"kind":"Name","value":"isCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"customMealName"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"calories"}},{"kind":"Field","name":{"kind":"Name","value":"protein"}},{"kind":"Field","name":{"kind":"Name","value":"carbs"}},{"kind":"Field","name":{"kind":"Name","value":"fat"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedCost"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionSource"}},{"kind":"Field","name":{"kind":"Name","value":"usedPantryItems"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanRecipeFragment"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateMealPlanFromTemplateMutation__
 *
 * To run a mutation, you first call `useCreateMealPlanFromTemplateMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateMealPlanFromTemplateMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createMealPlanFromTemplateMutation, { data, loading, error }] = useCreateMealPlanFromTemplateMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateMealPlanFromTemplateMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateMealPlanFromTemplateMutation, CreateMealPlanFromTemplateMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateMealPlanFromTemplateMutation, CreateMealPlanFromTemplateMutationVariables>(CreateMealPlanFromTemplateDocument, options);
      }
export type CreateMealPlanFromTemplateMutationHookResult = ReturnType<typeof useCreateMealPlanFromTemplateMutation>;
export type CreateMealPlanFromTemplateMutationResult = ApolloReactCommon.MutationResult<CreateMealPlanFromTemplateMutation>;
export type CreateMealPlanFromTemplateMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateMealPlanFromTemplateMutation, CreateMealPlanFromTemplateMutationVariables>;
export const CreateTemplateFromMealPlanDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTemplateFromMealPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTemplateFromMealPlanInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTemplateFromMealPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealTemplate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealTemplateDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealTemplateItemFragment"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealTemplateDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealTemplate"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"durationDays"}},{"kind":"Field","name":{"kind":"Name","value":"defaultServings"}},{"kind":"Field","name":{"kind":"Name","value":"tags"}},{"kind":"Field","name":{"kind":"Name","value":"usageCount"}},{"kind":"Field","name":{"kind":"Name","value":"lastUsedAt"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealTemplateItemFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealTemplateItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dayOffset"}},{"kind":"Field","name":{"kind":"Name","value":"mealType"}},{"kind":"Field","name":{"kind":"Name","value":"customMealName"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanRecipeFragment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateTemplateFromMealPlanMutation__
 *
 * To run a mutation, you first call `useCreateTemplateFromMealPlanMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateTemplateFromMealPlanMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createTemplateFromMealPlanMutation, { data, loading, error }] = useCreateTemplateFromMealPlanMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateTemplateFromMealPlanMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateTemplateFromMealPlanMutation, CreateTemplateFromMealPlanMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateTemplateFromMealPlanMutation, CreateTemplateFromMealPlanMutationVariables>(CreateTemplateFromMealPlanDocument, options);
      }
export type CreateTemplateFromMealPlanMutationHookResult = ReturnType<typeof useCreateTemplateFromMealPlanMutation>;
export type CreateTemplateFromMealPlanMutationResult = ApolloReactCommon.MutationResult<CreateTemplateFromMealPlanMutation>;
export type CreateTemplateFromMealPlanMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateTemplateFromMealPlanMutation, CreateTemplateFromMealPlanMutationVariables>;