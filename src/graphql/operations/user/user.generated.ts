// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetNotificationPreferencesQueryVariables = Types.Exact<{
  [key: string]: never;
}>;

export type GetNotificationPreferencesQuery = {
  __typename: 'Query';
  me: {
    __typename: 'User';
    id: string;
    notificationPreferences: {
      __typename: 'NotificationPreferences';
      id: string;
      userId: string;
      emailEnabled: boolean;
      pushEnabled: boolean;
      smsEnabled: boolean;
      expirationNotifications: boolean;
      expirationNotificationFrequency: Types.ExpirationFrequency;
      expirationDaysThreshold: number;
      lowStockAlerts: boolean;
      shoppingListUpdates: boolean;
      pantryChanges: boolean;
      recipeRecommendations: boolean;
      mealPlanReminders: boolean;
      cookingReminders: boolean;
      collaborationInvites: boolean;
      homeInvites: boolean;
      sharedListUpdates: boolean;
      weeklyDigest: boolean;
      monthlyReport: boolean;
      quietHoursEnabled: boolean;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      quietHoursTimezone: string | null;
    } | null;
  } | null;
};

export type GetDietaryProfileQueryVariables = Types.Exact<{
  [key: string]: never;
}>;

export type GetDietaryProfileQuery = {
  __typename: 'Query';
  me: {
    __typename: 'User';
    id: string;
    dietaryProfile: {
      __typename: 'DietaryProfile';
      id: string;
      userId: string;
      preferredCuisines: Array<string>;
      dislikedIngredients: Array<string>;
      favoriteIngredients: Array<string>;
      calorieTarget: number | null;
      proteinTarget: number | null;
      carbsTarget: number | null;
      fatTarget: number | null;
      mealsPerDay: number;
      snacksPerDay: number;
      cookingSkillLevel: string | null;
      maxPrepTimeMinutes: number | null;
      maxCookTimeMinutes: number | null;
      budgetPerMeal: number | null;
      createdAt: string;
      updatedAt: string;
      restrictions: Array<{
        __typename: 'DietaryRestriction';
        id: string;
        diet: Types.Diet | null;
        intolerance: Types.Intolerance | null;
        healthGoal: Types.HealthGoal | null;
        severity: Types.RestrictionSeverity;
        notes: string | null;
        appliesToHomeId: string | null;
        createdAt: string;
      }>;
    } | null;
  } | null;
};

export type UpdateNotificationPreferencesMutationVariables = Types.Exact<{
  input: Types.UpdateNotificationPreferencesInput;
}>;

export type UpdateNotificationPreferencesMutation = {
  __typename: 'Mutation';
  updateNotificationPreferences: {
    __typename: 'NotificationPreferencesPayload';
    success: boolean;
    message: string;
    code: string;
    notificationPreferences: {
      __typename: 'NotificationPreferences';
      id: string;
      userId: string;
      emailEnabled: boolean;
      pushEnabled: boolean;
      smsEnabled: boolean;
      expirationNotifications: boolean;
      expirationNotificationFrequency: Types.ExpirationFrequency;
      expirationDaysThreshold: number;
      lowStockAlerts: boolean;
      shoppingListUpdates: boolean;
      pantryChanges: boolean;
      recipeRecommendations: boolean;
      mealPlanReminders: boolean;
      cookingReminders: boolean;
      collaborationInvites: boolean;
      homeInvites: boolean;
      sharedListUpdates: boolean;
      weeklyDigest: boolean;
      monthlyReport: boolean;
      quietHoursEnabled: boolean;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      quietHoursTimezone: string | null;
    } | null;
  };
};

export type UpdateDietaryProfileMutationVariables = Types.Exact<{
  input: Types.UpdateDietaryProfileInput;
}>;

export type UpdateDietaryProfileMutation = {
  __typename: 'Mutation';
  updateDietaryProfile: {
    __typename: 'DietaryProfilePayload';
    success: boolean;
    message: string;
    code: string;
    dietaryProfile: {
      __typename: 'DietaryProfile';
      id: string;
      userId: string;
      preferredCuisines: Array<string>;
      dislikedIngredients: Array<string>;
      favoriteIngredients: Array<string>;
      calorieTarget: number | null;
      proteinTarget: number | null;
      carbsTarget: number | null;
      fatTarget: number | null;
      mealsPerDay: number;
      snacksPerDay: number;
      cookingSkillLevel: string | null;
      maxPrepTimeMinutes: number | null;
      maxCookTimeMinutes: number | null;
      budgetPerMeal: number | null;
      createdAt: string;
      updatedAt: string;
      restrictions: Array<{
        __typename: 'DietaryRestriction';
        id: string;
        diet: Types.Diet | null;
        intolerance: Types.Intolerance | null;
        healthGoal: Types.HealthGoal | null;
        severity: Types.RestrictionSeverity;
        notes: string | null;
        appliesToHomeId: string | null;
        createdAt: string;
      }>;
    } | null;
  };
};

export type AddDietaryRestrictionMutationVariables = Types.Exact<{
  input: Types.AddRestrictionInput;
}>;

export type AddDietaryRestrictionMutation = {
  __typename: 'Mutation';
  addRestriction: {
    __typename: 'DietaryRestrictionPayload';
    success: boolean;
    message: string;
    code: string;
    dietaryRestriction: {
      __typename: 'DietaryRestriction';
      id: string;
      diet: Types.Diet | null;
      intolerance: Types.Intolerance | null;
      healthGoal: Types.HealthGoal | null;
      severity: Types.RestrictionSeverity;
      notes: string | null;
      appliesToHomeId: string | null;
      createdAt: string;
    } | null;
  };
};

export type UpdateDietaryRestrictionMutationVariables = Types.Exact<{
  input: Types.UpdateRestrictionInput;
}>;

export type UpdateDietaryRestrictionMutation = {
  __typename: 'Mutation';
  updateRestriction: {
    __typename: 'DietaryRestrictionPayload';
    success: boolean;
    message: string;
    code: string;
    dietaryRestriction: {
      __typename: 'DietaryRestriction';
      id: string;
      diet: Types.Diet | null;
      intolerance: Types.Intolerance | null;
      healthGoal: Types.HealthGoal | null;
      severity: Types.RestrictionSeverity;
      notes: string | null;
      appliesToHomeId: string | null;
      createdAt: string;
    } | null;
  };
};

export type RemoveDietaryRestrictionMutationVariables = Types.Exact<{
  input: Types.RemoveRestrictionInput;
}>;

export type RemoveDietaryRestrictionMutation = {
  __typename: 'Mutation';
  removeRestriction: {
    __typename: 'DietaryRestrictionPayload';
    success: boolean;
    message: string;
    code: string;
  };
};

export const GetNotificationPreferencesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetNotificationPreferences' },
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
                  name: { kind: 'Name', value: 'notificationPreferences' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'userId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'emailEnabled' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pushEnabled' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'smsEnabled' },
                      },
                      {
                        kind: 'Field',
                        name: {
                          kind: 'Name',
                          value: 'expirationNotifications',
                        },
                      },
                      {
                        kind: 'Field',
                        name: {
                          kind: 'Name',
                          value: 'expirationNotificationFrequency',
                        },
                      },
                      {
                        kind: 'Field',
                        name: {
                          kind: 'Name',
                          value: 'expirationDaysThreshold',
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lowStockAlerts' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shoppingListUpdates' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryChanges' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'recipeRecommendations' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mealPlanReminders' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cookingReminders' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'collaborationInvites' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'homeInvites' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'sharedListUpdates' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'weeklyDigest' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'monthlyReport' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quietHoursEnabled' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quietHoursStart' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quietHoursEnd' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quietHoursTimezone' },
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
 * __useGetNotificationPreferencesQuery__
 *
 * To run a query within a React component, call `useGetNotificationPreferencesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetNotificationPreferencesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetNotificationPreferencesQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetNotificationPreferencesQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetNotificationPreferencesQuery,
    GetNotificationPreferencesQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetNotificationPreferencesQuery,
    GetNotificationPreferencesQueryVariables
  >(GetNotificationPreferencesDocument, options);
}
export function useGetNotificationPreferencesLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetNotificationPreferencesQuery,
    GetNotificationPreferencesQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetNotificationPreferencesQuery,
    GetNotificationPreferencesQueryVariables
  >(GetNotificationPreferencesDocument, options);
}
// @ts-ignore
export function useGetNotificationPreferencesSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetNotificationPreferencesQuery,
    GetNotificationPreferencesQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetNotificationPreferencesQuery,
  GetNotificationPreferencesQueryVariables
>;
export function useGetNotificationPreferencesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetNotificationPreferencesQuery,
        GetNotificationPreferencesQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetNotificationPreferencesQuery | undefined,
  GetNotificationPreferencesQueryVariables
>;
export function useGetNotificationPreferencesSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetNotificationPreferencesQuery,
        GetNotificationPreferencesQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetNotificationPreferencesQuery,
    GetNotificationPreferencesQueryVariables
  >(GetNotificationPreferencesDocument, options);
}
export type GetNotificationPreferencesQueryHookResult = ReturnType<
  typeof useGetNotificationPreferencesQuery
>;
export type GetNotificationPreferencesLazyQueryHookResult = ReturnType<
  typeof useGetNotificationPreferencesLazyQuery
>;
export type GetNotificationPreferencesSuspenseQueryHookResult = ReturnType<
  typeof useGetNotificationPreferencesSuspenseQuery
>;
export type GetNotificationPreferencesQueryResult =
  ApolloReactCommon.QueryResult<
    GetNotificationPreferencesQuery,
    GetNotificationPreferencesQueryVariables
  >;
export const GetDietaryProfileDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetDietaryProfile' },
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
                  name: { kind: 'Name', value: 'dietaryProfile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'userId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'preferredCuisines' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dislikedIngredients' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'favoriteIngredients' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'calorieTarget' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'proteinTarget' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'carbsTarget' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'fatTarget' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mealsPerDay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'snacksPerDay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cookingSkillLevel' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'maxPrepTimeMinutes' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'maxCookTimeMinutes' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'budgetPerMeal' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'restrictions' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'diet' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'intolerance' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'healthGoal' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'severity' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'notes' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'appliesToHomeId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'createdAt' },
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
  ],
} as unknown as DocumentNode;

/**
 * __useGetDietaryProfileQuery__
 *
 * To run a query within a React component, call `useGetDietaryProfileQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetDietaryProfileQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetDietaryProfileQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetDietaryProfileQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetDietaryProfileQuery,
    GetDietaryProfileQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetDietaryProfileQuery,
    GetDietaryProfileQueryVariables
  >(GetDietaryProfileDocument, options);
}
export function useGetDietaryProfileLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetDietaryProfileQuery,
    GetDietaryProfileQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetDietaryProfileQuery,
    GetDietaryProfileQueryVariables
  >(GetDietaryProfileDocument, options);
}
// @ts-ignore
export function useGetDietaryProfileSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetDietaryProfileQuery,
    GetDietaryProfileQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetDietaryProfileQuery,
  GetDietaryProfileQueryVariables
>;
export function useGetDietaryProfileSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetDietaryProfileQuery,
        GetDietaryProfileQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetDietaryProfileQuery | undefined,
  GetDietaryProfileQueryVariables
>;
export function useGetDietaryProfileSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetDietaryProfileQuery,
        GetDietaryProfileQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetDietaryProfileQuery,
    GetDietaryProfileQueryVariables
  >(GetDietaryProfileDocument, options);
}
export type GetDietaryProfileQueryHookResult = ReturnType<
  typeof useGetDietaryProfileQuery
>;
export type GetDietaryProfileLazyQueryHookResult = ReturnType<
  typeof useGetDietaryProfileLazyQuery
>;
export type GetDietaryProfileSuspenseQueryHookResult = ReturnType<
  typeof useGetDietaryProfileSuspenseQuery
>;
export type GetDietaryProfileQueryResult = ApolloReactCommon.QueryResult<
  GetDietaryProfileQuery,
  GetDietaryProfileQueryVariables
>;
export const UpdateNotificationPreferencesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateNotificationPreferences' },
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
              name: {
                kind: 'Name',
                value: 'UpdateNotificationPreferencesInput',
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateNotificationPreferences' },
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
                  name: { kind: 'Name', value: 'notificationPreferences' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'userId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'emailEnabled' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pushEnabled' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'smsEnabled' },
                      },
                      {
                        kind: 'Field',
                        name: {
                          kind: 'Name',
                          value: 'expirationNotifications',
                        },
                      },
                      {
                        kind: 'Field',
                        name: {
                          kind: 'Name',
                          value: 'expirationNotificationFrequency',
                        },
                      },
                      {
                        kind: 'Field',
                        name: {
                          kind: 'Name',
                          value: 'expirationDaysThreshold',
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lowStockAlerts' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shoppingListUpdates' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'pantryChanges' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'recipeRecommendations' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mealPlanReminders' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cookingReminders' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'collaborationInvites' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'homeInvites' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'sharedListUpdates' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'weeklyDigest' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'monthlyReport' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quietHoursEnabled' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quietHoursStart' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quietHoursEnd' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'quietHoursTimezone' },
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
 * __useUpdateNotificationPreferencesMutation__
 *
 * To run a mutation, you first call `useUpdateNotificationPreferencesMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateNotificationPreferencesMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateNotificationPreferencesMutation, { data, loading, error }] = useUpdateNotificationPreferencesMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateNotificationPreferencesMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateNotificationPreferencesMutation,
    UpdateNotificationPreferencesMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateNotificationPreferencesMutation,
    UpdateNotificationPreferencesMutationVariables
  >(UpdateNotificationPreferencesDocument, options);
}
export type UpdateNotificationPreferencesMutationHookResult = ReturnType<
  typeof useUpdateNotificationPreferencesMutation
>;
export type UpdateNotificationPreferencesMutationResult =
  ApolloReactCommon.MutationResult<UpdateNotificationPreferencesMutation>;
export type UpdateNotificationPreferencesMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateNotificationPreferencesMutation,
    UpdateNotificationPreferencesMutationVariables
  >;
export const UpdateDietaryProfileDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDietaryProfile' },
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
              name: { kind: 'Name', value: 'UpdateDietaryProfileInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateDietaryProfile' },
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
                  name: { kind: 'Name', value: 'dietaryProfile' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'userId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'preferredCuisines' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dislikedIngredients' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'favoriteIngredients' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'calorieTarget' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'proteinTarget' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'carbsTarget' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'fatTarget' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mealsPerDay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'snacksPerDay' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'cookingSkillLevel' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'maxPrepTimeMinutes' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'maxCookTimeMinutes' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'budgetPerMeal' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'updatedAt' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'restrictions' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'id' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'diet' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'intolerance' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'healthGoal' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'severity' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'notes' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'appliesToHomeId' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'createdAt' },
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
  ],
} as unknown as DocumentNode;

/**
 * __useUpdateDietaryProfileMutation__
 *
 * To run a mutation, you first call `useUpdateDietaryProfileMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateDietaryProfileMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateDietaryProfileMutation, { data, loading, error }] = useUpdateDietaryProfileMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateDietaryProfileMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateDietaryProfileMutation,
    UpdateDietaryProfileMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateDietaryProfileMutation,
    UpdateDietaryProfileMutationVariables
  >(UpdateDietaryProfileDocument, options);
}
export type UpdateDietaryProfileMutationHookResult = ReturnType<
  typeof useUpdateDietaryProfileMutation
>;
export type UpdateDietaryProfileMutationResult =
  ApolloReactCommon.MutationResult<UpdateDietaryProfileMutation>;
export type UpdateDietaryProfileMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateDietaryProfileMutation,
    UpdateDietaryProfileMutationVariables
  >;
export const AddDietaryRestrictionDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'AddDietaryRestriction' },
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
              name: { kind: 'Name', value: 'AddRestrictionInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'addRestriction' },
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
                  name: { kind: 'Name', value: 'dietaryRestriction' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'diet' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'intolerance' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'healthGoal' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'severity' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'appliesToHomeId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
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
 * __useAddDietaryRestrictionMutation__
 *
 * To run a mutation, you first call `useAddDietaryRestrictionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useAddDietaryRestrictionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [addDietaryRestrictionMutation, { data, loading, error }] = useAddDietaryRestrictionMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useAddDietaryRestrictionMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    AddDietaryRestrictionMutation,
    AddDietaryRestrictionMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    AddDietaryRestrictionMutation,
    AddDietaryRestrictionMutationVariables
  >(AddDietaryRestrictionDocument, options);
}
export type AddDietaryRestrictionMutationHookResult = ReturnType<
  typeof useAddDietaryRestrictionMutation
>;
export type AddDietaryRestrictionMutationResult =
  ApolloReactCommon.MutationResult<AddDietaryRestrictionMutation>;
export type AddDietaryRestrictionMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    AddDietaryRestrictionMutation,
    AddDietaryRestrictionMutationVariables
  >;
export const UpdateDietaryRestrictionDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateDietaryRestriction' },
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
              name: { kind: 'Name', value: 'UpdateRestrictionInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateRestriction' },
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
                  name: { kind: 'Name', value: 'dietaryRestriction' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'diet' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'intolerance' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'healthGoal' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'severity' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'notes' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'appliesToHomeId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
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
 * __useUpdateDietaryRestrictionMutation__
 *
 * To run a mutation, you first call `useUpdateDietaryRestrictionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateDietaryRestrictionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateDietaryRestrictionMutation, { data, loading, error }] = useUpdateDietaryRestrictionMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateDietaryRestrictionMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateDietaryRestrictionMutation,
    UpdateDietaryRestrictionMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateDietaryRestrictionMutation,
    UpdateDietaryRestrictionMutationVariables
  >(UpdateDietaryRestrictionDocument, options);
}
export type UpdateDietaryRestrictionMutationHookResult = ReturnType<
  typeof useUpdateDietaryRestrictionMutation
>;
export type UpdateDietaryRestrictionMutationResult =
  ApolloReactCommon.MutationResult<UpdateDietaryRestrictionMutation>;
export type UpdateDietaryRestrictionMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateDietaryRestrictionMutation,
    UpdateDietaryRestrictionMutationVariables
  >;
export const RemoveDietaryRestrictionDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'RemoveDietaryRestriction' },
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
              name: { kind: 'Name', value: 'RemoveRestrictionInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'removeRestriction' },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useRemoveDietaryRestrictionMutation__
 *
 * To run a mutation, you first call `useRemoveDietaryRestrictionMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useRemoveDietaryRestrictionMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [removeDietaryRestrictionMutation, { data, loading, error }] = useRemoveDietaryRestrictionMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useRemoveDietaryRestrictionMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    RemoveDietaryRestrictionMutation,
    RemoveDietaryRestrictionMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    RemoveDietaryRestrictionMutation,
    RemoveDietaryRestrictionMutationVariables
  >(RemoveDietaryRestrictionDocument, options);
}
export type RemoveDietaryRestrictionMutationHookResult = ReturnType<
  typeof useRemoveDietaryRestrictionMutation
>;
export type RemoveDietaryRestrictionMutationResult =
  ApolloReactCommon.MutationResult<RemoveDietaryRestrictionMutation>;
export type RemoveDietaryRestrictionMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    RemoveDietaryRestrictionMutation,
    RemoveDietaryRestrictionMutationVariables
  >;
