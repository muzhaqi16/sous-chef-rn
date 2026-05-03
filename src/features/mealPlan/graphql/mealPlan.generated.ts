// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../../graphql/generated/baseTypes';

import type { MealPlanDisplayFragment, MealPlanFullFragment, MealPlanItemFragment } from '../../../graphql/operations/fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetMealPlansQueryVariables = Types.Exact<{
  first?: Types.InputMaybe<Types.Scalars['Int']['input']>;
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
  filters?: Types.InputMaybe<Types.MealPlanFilters>;
  orderBy?: Types.InputMaybe<Types.MealPlanOrderBy>;
}>;


export type GetMealPlansQuery = { __typename: 'Query', mealPlans: { __typename: 'MealPlanConnection', totalCount: number | null, edges: Array<{ __typename: 'MealPlanEdge', cursor: string, node: (
        { __typename: 'MealPlan' }
        & MealPlanDisplayFragment
      ) }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type GetMealPlanQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetMealPlanQuery = { __typename: 'Query', mealPlan: (
    { __typename: 'MealPlan' }
    & MealPlanFullFragment
  ) | null };

export type CreateMealPlanMutationVariables = Types.Exact<{
  input: Types.CreateMealPlanInput;
}>;


export type CreateMealPlanMutation = { __typename: 'Mutation', createMealPlan: { __typename: 'MealPlanPayload', success: boolean, message: string, code: string, mealPlan: (
      { __typename: 'MealPlan' }
      & MealPlanDisplayFragment
    ) | null } };

export type UpdateMealPlanMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateMealPlanInput;
}>;


export type UpdateMealPlanMutation = { __typename: 'Mutation', updateMealPlan: { __typename: 'MealPlanPayload', success: boolean, message: string, code: string, mealPlan: (
      { __typename: 'MealPlan' }
      & MealPlanDisplayFragment
    ) | null } };

export type DeleteMealPlanMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteMealPlanMutation = { __typename: 'Mutation', deleteMealPlan: { __typename: 'MealPlanPayload', success: boolean, message: string, code: string, mealPlan: { __typename: 'MealPlan', id: string } | null } };

export type CreateMealPlanItemMutationVariables = Types.Exact<{
  input: Types.CreateMealPlanItemInput;
}>;


export type CreateMealPlanItemMutation = { __typename: 'Mutation', createMealPlanItem: { __typename: 'MealPlanItemPayload', success: boolean, message: string, code: string, mealPlanItem: (
      { __typename: 'MealPlanItem' }
      & MealPlanItemFragment
    ) | null } };

export type UpdateMealPlanItemMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateMealPlanItemInput;
}>;


export type UpdateMealPlanItemMutation = { __typename: 'Mutation', updateMealPlanItem: { __typename: 'MealPlanItemPayload', success: boolean, message: string, code: string, mealPlanItem: (
      { __typename: 'MealPlanItem' }
      & MealPlanItemFragment
    ) | null } };

export type DeleteMealPlanItemMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteMealPlanItemMutation = { __typename: 'Mutation', deleteMealPlanItem: { __typename: 'MealPlanItemPayload', success: boolean, message: string, code: string, mealPlanItem: { __typename: 'MealPlanItem', id: string } | null } };

export type DuplicateMealPlanMutationVariables = Types.Exact<{
  input: Types.DuplicateMealPlanInput;
}>;


export type DuplicateMealPlanMutation = { __typename: 'Mutation', duplicateMealPlan: { __typename: 'MealPlanPayload', success: boolean, message: string, code: string, mealPlan: (
      { __typename: 'MealPlan' }
      & MealPlanDisplayFragment
    ) | null } };

export type GenerateShoppingListFromMealPlanMutationVariables = Types.Exact<{
  input: Types.GenerateShoppingListFromMealPlanInput;
}>;


export type GenerateShoppingListFromMealPlanMutation = { __typename: 'Mutation', generateShoppingListFromMealPlan: { __typename: 'ShoppingListPayload', success: boolean, message: string, code: string, shoppingList: { __typename: 'ShoppingList', id: string, name: string, totalItems: number, homeId: string | null, home: { __typename: 'Home', id: string, name: string } | null } | null } };


export const GetMealPlansDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMealPlans"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"first"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"after"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filters"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlanFilters"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlanOrderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mealPlans"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"first"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"after"}}},{"kind":"Argument","name":{"kind":"Name","value":"filters"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filters"}}},{"kind":"Argument","name":{"kind":"Name","value":"orderBy"},"value":{"kind":"Variable","name":{"kind":"Name","value":"orderBy"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanDisplay"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlan"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"planType"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"budgetAmount"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode;

/**
 * __useGetMealPlansQuery__
 *
 * To run a query within a React component, call `useGetMealPlansQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetMealPlansQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetMealPlansQuery({
 *   variables: {
 *      first: // value for 'first'
 *      after: // value for 'after'
 *      filters: // value for 'filters'
 *      orderBy: // value for 'orderBy'
 *   },
 * });
 */
export function useGetMealPlansQuery(baseOptions?: ApolloReactHooks.QueryHookOptions<GetMealPlansQuery, GetMealPlansQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetMealPlansQuery, GetMealPlansQueryVariables>(GetMealPlansDocument, options);
      }
export function useGetMealPlansLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetMealPlansQuery, GetMealPlansQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetMealPlansQuery, GetMealPlansQueryVariables>(GetMealPlansDocument, options);
        }
// @ts-ignore
export function useGetMealPlansSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetMealPlansQuery, GetMealPlansQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetMealPlansQuery, GetMealPlansQueryVariables>;
export function useGetMealPlansSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetMealPlansQuery, GetMealPlansQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetMealPlansQuery | undefined, GetMealPlansQueryVariables>;
export function useGetMealPlansSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetMealPlansQuery, GetMealPlansQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetMealPlansQuery, GetMealPlansQueryVariables>(GetMealPlansDocument, options);
        }
export type GetMealPlansQueryHookResult = ReturnType<typeof useGetMealPlansQuery>;
export type GetMealPlansLazyQueryHookResult = ReturnType<typeof useGetMealPlansLazyQuery>;
export type GetMealPlansSuspenseQueryHookResult = ReturnType<typeof useGetMealPlansSuspenseQuery>;
export type GetMealPlansQueryResult = ApolloReactCommon.QueryResult<GetMealPlansQuery, GetMealPlansQueryVariables>;
export const GetMealPlanDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMealPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mealPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanFull"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlan"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"planType"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"budgetAmount"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanFull"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlan"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanDisplay"}},{"kind":"Field","name":{"kind":"Name","value":"dietaryProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"calorieTarget"}},{"kind":"Field","name":{"kind":"Name","value":"proteinTarget"}},{"kind":"Field","name":{"kind":"Name","value":"carbsTarget"}},{"kind":"Field","name":{"kind":"Name","value":"fatTarget"}}]}},{"kind":"Field","name":{"kind":"Name","value":"mealPlanItems"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanItemFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"generatedShoppingLists"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionSummary"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"avgDailyCalories"}},{"kind":"Field","name":{"kind":"Name","value":"avgDailyProtein"}},{"kind":"Field","name":{"kind":"Name","value":"avgDailyCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"avgDailyFat"}},{"kind":"Field","name":{"kind":"Name","value":"totalMeals"}},{"kind":"Field","name":{"kind":"Name","value":"mealsWithNutrition"}},{"kind":"Field","name":{"kind":"Name","value":"coveragePercentage"}},{"kind":"Field","name":{"kind":"Name","value":"mealTypeBreakdown"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"mealType"}},{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"mealCount"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionGoalProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"overallScore"}},{"kind":"Field","name":{"kind":"Name","value":"caloriesProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"Field","name":{"kind":"Name","value":"proteinProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"Field","name":{"kind":"Name","value":"carbsProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}},{"kind":"Field","name":{"kind":"Name","value":"fatProgress"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"target"}},{"kind":"Field","name":{"kind":"Name","value":"current"}},{"kind":"Field","name":{"kind":"Name","value":"percentage"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanItemFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlanItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"mealType"}},{"kind":"Field","name":{"kind":"Name","value":"isCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"customMealName"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"calories"}},{"kind":"Field","name":{"kind":"Name","value":"protein"}},{"kind":"Field","name":{"kind":"Name","value":"carbs"}},{"kind":"Field","name":{"kind":"Name","value":"fat"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedCost"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionSource"}},{"kind":"Field","name":{"kind":"Name","value":"usedPantryItems"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanRecipeFragment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}}]}}]} as unknown as DocumentNode;

/**
 * __useGetMealPlanQuery__
 *
 * To run a query within a React component, call `useGetMealPlanQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetMealPlanQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetMealPlanQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetMealPlanQuery(baseOptions: ApolloReactHooks.QueryHookOptions<GetMealPlanQuery, GetMealPlanQueryVariables> & ({ variables: GetMealPlanQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetMealPlanQuery, GetMealPlanQueryVariables>(GetMealPlanDocument, options);
      }
export function useGetMealPlanLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetMealPlanQuery, GetMealPlanQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetMealPlanQuery, GetMealPlanQueryVariables>(GetMealPlanDocument, options);
        }
// @ts-ignore
export function useGetMealPlanSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetMealPlanQuery, GetMealPlanQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetMealPlanQuery, GetMealPlanQueryVariables>;
export function useGetMealPlanSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetMealPlanQuery, GetMealPlanQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetMealPlanQuery | undefined, GetMealPlanQueryVariables>;
export function useGetMealPlanSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetMealPlanQuery, GetMealPlanQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetMealPlanQuery, GetMealPlanQueryVariables>(GetMealPlanDocument, options);
        }
export type GetMealPlanQueryHookResult = ReturnType<typeof useGetMealPlanQuery>;
export type GetMealPlanLazyQueryHookResult = ReturnType<typeof useGetMealPlanLazyQuery>;
export type GetMealPlanSuspenseQueryHookResult = ReturnType<typeof useGetMealPlanSuspenseQuery>;
export type GetMealPlanQueryResult = ApolloReactCommon.QueryResult<GetMealPlanQuery, GetMealPlanQueryVariables>;
export const CreateMealPlanDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMealPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMealPlanInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMealPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealPlan"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanDisplay"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlan"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"planType"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"budgetAmount"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateMealPlanMutation__
 *
 * To run a mutation, you first call `useCreateMealPlanMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateMealPlanMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createMealPlanMutation, { data, loading, error }] = useCreateMealPlanMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateMealPlanMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateMealPlanMutation, CreateMealPlanMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateMealPlanMutation, CreateMealPlanMutationVariables>(CreateMealPlanDocument, options);
      }
export type CreateMealPlanMutationHookResult = ReturnType<typeof useCreateMealPlanMutation>;
export type CreateMealPlanMutationResult = ApolloReactCommon.MutationResult<CreateMealPlanMutation>;
export type CreateMealPlanMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateMealPlanMutation, CreateMealPlanMutationVariables>;
export const UpdateMealPlanDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMealPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateMealPlanInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMealPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealPlan"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanDisplay"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlan"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"planType"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"budgetAmount"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode;

/**
 * __useUpdateMealPlanMutation__
 *
 * To run a mutation, you first call `useUpdateMealPlanMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateMealPlanMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateMealPlanMutation, { data, loading, error }] = useUpdateMealPlanMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateMealPlanMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UpdateMealPlanMutation, UpdateMealPlanMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UpdateMealPlanMutation, UpdateMealPlanMutationVariables>(UpdateMealPlanDocument, options);
      }
export type UpdateMealPlanMutationHookResult = ReturnType<typeof useUpdateMealPlanMutation>;
export type UpdateMealPlanMutationResult = ApolloReactCommon.MutationResult<UpdateMealPlanMutation>;
export type UpdateMealPlanMutationOptions = ApolloReactCommon.BaseMutationOptions<UpdateMealPlanMutation, UpdateMealPlanMutationVariables>;
export const DeleteMealPlanDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMealPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMealPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealPlan"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useDeleteMealPlanMutation__
 *
 * To run a mutation, you first call `useDeleteMealPlanMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteMealPlanMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteMealPlanMutation, { data, loading, error }] = useDeleteMealPlanMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteMealPlanMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DeleteMealPlanMutation, DeleteMealPlanMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DeleteMealPlanMutation, DeleteMealPlanMutationVariables>(DeleteMealPlanDocument, options);
      }
export type DeleteMealPlanMutationHookResult = ReturnType<typeof useDeleteMealPlanMutation>;
export type DeleteMealPlanMutationResult = ApolloReactCommon.MutationResult<DeleteMealPlanMutation>;
export type DeleteMealPlanMutationOptions = ApolloReactCommon.BaseMutationOptions<DeleteMealPlanMutation, DeleteMealPlanMutationVariables>;
export const CreateMealPlanItemDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMealPlanItem"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateMealPlanItemInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMealPlanItem"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealPlanItem"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanItemFragment"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanItemFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlanItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"mealType"}},{"kind":"Field","name":{"kind":"Name","value":"isCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"customMealName"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"calories"}},{"kind":"Field","name":{"kind":"Name","value":"protein"}},{"kind":"Field","name":{"kind":"Name","value":"carbs"}},{"kind":"Field","name":{"kind":"Name","value":"fat"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedCost"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionSource"}},{"kind":"Field","name":{"kind":"Name","value":"usedPantryItems"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanRecipeFragment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateMealPlanItemMutation__
 *
 * To run a mutation, you first call `useCreateMealPlanItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateMealPlanItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createMealPlanItemMutation, { data, loading, error }] = useCreateMealPlanItemMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateMealPlanItemMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateMealPlanItemMutation, CreateMealPlanItemMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateMealPlanItemMutation, CreateMealPlanItemMutationVariables>(CreateMealPlanItemDocument, options);
      }
export type CreateMealPlanItemMutationHookResult = ReturnType<typeof useCreateMealPlanItemMutation>;
export type CreateMealPlanItemMutationResult = ApolloReactCommon.MutationResult<CreateMealPlanItemMutation>;
export type CreateMealPlanItemMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateMealPlanItemMutation, CreateMealPlanItemMutationVariables>;
export const UpdateMealPlanItemDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateMealPlanItem"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateMealPlanItemInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMealPlanItem"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealPlanItem"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanItemFragment"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanItemFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlanItem"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"mealType"}},{"kind":"Field","name":{"kind":"Name","value":"isCompleted"}},{"kind":"Field","name":{"kind":"Name","value":"completedAt"}},{"kind":"Field","name":{"kind":"Name","value":"customMealName"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"calories"}},{"kind":"Field","name":{"kind":"Name","value":"protein"}},{"kind":"Field","name":{"kind":"Name","value":"carbs"}},{"kind":"Field","name":{"kind":"Name","value":"fat"}},{"kind":"Field","name":{"kind":"Name","value":"estimatedCost"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionSource"}},{"kind":"Field","name":{"kind":"Name","value":"usedPantryItems"}},{"kind":"Field","name":{"kind":"Name","value":"recipe"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanRecipeFragment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanRecipeFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Recipe"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"imageUrl"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalTimeMinutes"}}]}}]} as unknown as DocumentNode;

/**
 * __useUpdateMealPlanItemMutation__
 *
 * To run a mutation, you first call `useUpdateMealPlanItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateMealPlanItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateMealPlanItemMutation, { data, loading, error }] = useUpdateMealPlanItemMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateMealPlanItemMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UpdateMealPlanItemMutation, UpdateMealPlanItemMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UpdateMealPlanItemMutation, UpdateMealPlanItemMutationVariables>(UpdateMealPlanItemDocument, options);
      }
export type UpdateMealPlanItemMutationHookResult = ReturnType<typeof useUpdateMealPlanItemMutation>;
export type UpdateMealPlanItemMutationResult = ApolloReactCommon.MutationResult<UpdateMealPlanItemMutation>;
export type UpdateMealPlanItemMutationOptions = ApolloReactCommon.BaseMutationOptions<UpdateMealPlanItemMutation, UpdateMealPlanItemMutationVariables>;
export const DeleteMealPlanItemDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMealPlanItem"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMealPlanItem"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealPlanItem"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useDeleteMealPlanItemMutation__
 *
 * To run a mutation, you first call `useDeleteMealPlanItemMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteMealPlanItemMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteMealPlanItemMutation, { data, loading, error }] = useDeleteMealPlanItemMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteMealPlanItemMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DeleteMealPlanItemMutation, DeleteMealPlanItemMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DeleteMealPlanItemMutation, DeleteMealPlanItemMutationVariables>(DeleteMealPlanItemDocument, options);
      }
export type DeleteMealPlanItemMutationHookResult = ReturnType<typeof useDeleteMealPlanItemMutation>;
export type DeleteMealPlanItemMutationResult = ApolloReactCommon.MutationResult<DeleteMealPlanItemMutation>;
export type DeleteMealPlanItemMutationOptions = ApolloReactCommon.BaseMutationOptions<DeleteMealPlanItemMutation, DeleteMealPlanItemMutationVariables>;
export const DuplicateMealPlanDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DuplicateMealPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DuplicateMealPlanInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"duplicateMealPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"mealPlan"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MealPlanDisplay"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MealPlanDisplay"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"MealPlan"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"planType"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"endDate"}},{"kind":"Field","name":{"kind":"Name","value":"servings"}},{"kind":"Field","name":{"kind":"Name","value":"totalCalories"}},{"kind":"Field","name":{"kind":"Name","value":"totalProtein"}},{"kind":"Field","name":{"kind":"Name","value":"totalCarbs"}},{"kind":"Field","name":{"kind":"Name","value":"totalFat"}},{"kind":"Field","name":{"kind":"Name","value":"actualCost"}},{"kind":"Field","name":{"kind":"Name","value":"budgetAmount"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"myMembership"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"role"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdBy"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"profile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode;

/**
 * __useDuplicateMealPlanMutation__
 *
 * To run a mutation, you first call `useDuplicateMealPlanMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDuplicateMealPlanMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [duplicateMealPlanMutation, { data, loading, error }] = useDuplicateMealPlanMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useDuplicateMealPlanMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DuplicateMealPlanMutation, DuplicateMealPlanMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DuplicateMealPlanMutation, DuplicateMealPlanMutationVariables>(DuplicateMealPlanDocument, options);
      }
export type DuplicateMealPlanMutationHookResult = ReturnType<typeof useDuplicateMealPlanMutation>;
export type DuplicateMealPlanMutationResult = ApolloReactCommon.MutationResult<DuplicateMealPlanMutation>;
export type DuplicateMealPlanMutationOptions = ApolloReactCommon.BaseMutationOptions<DuplicateMealPlanMutation, DuplicateMealPlanMutationVariables>;
export const GenerateShoppingListFromMealPlanDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateShoppingListFromMealPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GenerateShoppingListFromMealPlanInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateShoppingListFromMealPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"shoppingList"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"totalItems"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"home"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useGenerateShoppingListFromMealPlanMutation__
 *
 * To run a mutation, you first call `useGenerateShoppingListFromMealPlanMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useGenerateShoppingListFromMealPlanMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [generateShoppingListFromMealPlanMutation, { data, loading, error }] = useGenerateShoppingListFromMealPlanMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useGenerateShoppingListFromMealPlanMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<GenerateShoppingListFromMealPlanMutation, GenerateShoppingListFromMealPlanMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<GenerateShoppingListFromMealPlanMutation, GenerateShoppingListFromMealPlanMutationVariables>(GenerateShoppingListFromMealPlanDocument, options);
      }
export type GenerateShoppingListFromMealPlanMutationHookResult = ReturnType<typeof useGenerateShoppingListFromMealPlanMutation>;
export type GenerateShoppingListFromMealPlanMutationResult = ApolloReactCommon.MutationResult<GenerateShoppingListFromMealPlanMutation>;
export type GenerateShoppingListFromMealPlanMutationOptions = ApolloReactCommon.BaseMutationOptions<GenerateShoppingListFromMealPlanMutation, GenerateShoppingListFromMealPlanMutationVariables>;