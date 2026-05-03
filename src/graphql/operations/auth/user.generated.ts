// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type {
  PartialUserFragment,
  AuthUserFragment,
} from '../fragments.generated';
import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetMeQueryVariables = Types.Exact<{ [key: string]: never }>;

export type GetMeQuery = {
  __typename: 'Query';
  me: ({ __typename: 'User' } & PartialUserFragment) | null;
};

export type GetUserSettingsQueryVariables = Types.Exact<{
  [key: string]: never;
}>;

export type GetUserSettingsQuery = {
  __typename: 'Query';
  me: {
    __typename: 'User';
    id: string;
    settings: {
      __typename: 'UserSettings';
      id: string;
      theme: Types.AppTheme;
      compactMode: boolean;
      showTutorials: boolean;
      autoSync: boolean;
      offlineMode: boolean;
      shareUsageData: boolean;
      shareWithPartners: boolean;
      personalizedAds: boolean;
      preferredUnitSystem: Types.UnitSystem;
      language: string;
      timezone: string;
      preferredCurrency: string;
      enabledFeatures: Array<string>;
      betaFeatures: Array<string>;
      createdAt: string;
      updatedAt: string;
    } | null;
  } | null;
};

export type GetUserProfileQueryVariables = Types.Exact<{
  [key: string]: never;
}>;

export type GetUserProfileQuery = {
  __typename: 'Query';
  me: {
    __typename: 'User';
    id: string;
    profile: {
      __typename: 'UserProfile';
      id: string;
      userId: string;
      firstName: string | null;
      lastName: string | null;
      displayName: string | null;
      bio: string | null;
      avatar: string | null;
      coverImage: string | null;
      phone: string | null;
      website: string | null;
      dateOfBirth: string | null;
      gender: string | null;
      profileVisibility: Types.ProfileVisibility;
      showEmail: boolean;
      showPhone: boolean;
      createdAt: string;
      updatedAt: string;
    } | null;
  } | null;
};

export type CanDeleteAccountQueryVariables = Types.Exact<{
  [key: string]: never;
}>;

export type CanDeleteAccountQuery = {
  __typename: 'Query';
  canDeleteAccount: {
    __typename: 'CanDeleteAccountResult';
    canDelete: boolean;
    blockers: Array<{
      __typename: 'DeletionBlocker';
      type: Types.DeletionBlockerType;
      resourceId: string;
      resourceName: string;
      message: string;
    }>;
  };
};

export type UpdateUserMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateUserInput;
}>;

export type UpdateUserMutation = {
  __typename: 'Mutation';
  updateUser: {
    __typename: 'UserPayload';
    success: boolean;
    message: string;
    code: string;
    user: {
      __typename: 'User';
      id: string;
      email: string;
      emailVerified: boolean;
      role: Types.UserRole;
      onBoarded: boolean;
      timezone: string | null;
      preferredCurrency: string | null;
      language: string | null;
      defaultShoppingListId: string | null;
      defaultHomeId: string | null;
      createdAt: string;
      updatedAt: string;
      lastActiveAt: string | null;
    } | null;
  };
};

export type UpdateUserProfileMutationVariables = Types.Exact<{
  input: Types.UpdateUserProfileInput;
}>;

export type UpdateUserProfileMutation = {
  __typename: 'Mutation';
  updateProfile: {
    __typename: 'UserProfilePayload';
    success: boolean;
    message: string;
    code: string;
    userProfile: {
      __typename: 'UserProfile';
      id: string;
      userId: string;
      firstName: string | null;
      lastName: string | null;
      displayName: string | null;
      bio: string | null;
      avatar: string | null;
      coverImage: string | null;
      phone: string | null;
      website: string | null;
      dateOfBirth: string | null;
      gender: string | null;
      profileVisibility: Types.ProfileVisibility;
      showEmail: boolean;
      showPhone: boolean;
      createdAt: string;
      updatedAt: string;
    } | null;
  };
};

export type UpdateUserPreferencesMutationVariables = Types.Exact<{
  input: Types.UpdateUserSettingsInput;
}>;

export type UpdateUserPreferencesMutation = {
  __typename: 'Mutation';
  updateSettings: {
    __typename: 'UserSettingsPayload';
    success: boolean;
    message: string;
    code: string;
    userSettings: {
      __typename: 'UserSettings';
      id: string;
      theme: Types.AppTheme;
      compactMode: boolean;
      showTutorials: boolean;
      autoSync: boolean;
      offlineMode: boolean;
      shareUsageData: boolean;
      shareWithPartners: boolean;
      personalizedAds: boolean;
      preferredUnitSystem: Types.UnitSystem;
      language: string;
      timezone: string;
      preferredCurrency: string;
      enabledFeatures: Array<string>;
      betaFeatures: Array<string>;
      createdAt: string;
      updatedAt: string;
      user: { __typename: 'User'; id: string; email: string };
    } | null;
  };
};

export type DeleteAccountMutationVariables = Types.Exact<{
  [key: string]: never;
}>;

export type DeleteAccountMutation = {
  __typename: 'Mutation';
  deleteAccount: {
    __typename: 'UserPayload';
    success: boolean;
    message: string;
    code: string;
  };
};

export type CompleteOnboardingMutationVariables = Types.Exact<{
  [key: string]: never;
}>;

export type CompleteOnboardingMutation = {
  __typename: 'Mutation';
  completeOnboarding: {
    __typename: 'UserPayload';
    success: boolean;
    message: string;
    code: string;
    user: ({ __typename: 'User' } & AuthUserFragment) | null;
  };
};

export type UserChangesSubscriptionVariables = Types.Exact<{
  userId?: Types.InputMaybe<Types.Scalars['ID']['input']>;
}>;

export type UserChangesSubscription = {
  __typename: 'Subscription';
  userChanged: {
    __typename: 'UserChangeEvent';
    changeType: Types.UserChangeType;
    updatedFields: Array<string> | null;
    timestamp: string;
    userId: string;
    user: {
      __typename: 'User';
      id: string;
      email: string;
      emailVerified: boolean;
      role: Types.UserRole;
      onBoarded: boolean;
      timezone: string | null;
      preferredCurrency: string | null;
      language: string | null;
      lastActiveAt: string | null;
    } | null;
    profile: {
      __typename: 'UserProfile';
      id: string;
      firstName: string | null;
      lastName: string | null;
      displayName: string | null;
      bio: string | null;
      avatar: string | null;
      coverImage: string | null;
      phone: string | null;
      website: string | null;
      profileVisibility: Types.ProfileVisibility;
    } | null;
  };
};

export const GetMeDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetMe' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'me' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PartialUser' },
                },
              ],
            },
          },
        ],
      },
    },
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
} as unknown as DocumentNode;

/**
 * __useGetMeQuery__
 *
 * To run a query within a React component, call `useGetMeQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetMeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetMeQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetMeQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetMeQuery,
    GetMeQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<GetMeQuery, GetMeQueryVariables>(
    GetMeDocument,
    options,
  );
}
export function useGetMeLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetMeQuery,
    GetMeQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<GetMeQuery, GetMeQueryVariables>(
    GetMeDocument,
    options,
  );
}
// @ts-ignore
export function useGetMeSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetMeQuery,
    GetMeQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<GetMeQuery, GetMeQueryVariables>;
export function useGetMeSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetMeQuery,
        GetMeQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetMeQuery | undefined,
  GetMeQueryVariables
>;
export function useGetMeSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetMeQuery,
        GetMeQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<GetMeQuery, GetMeQueryVariables>(
    GetMeDocument,
    options,
  );
}
export type GetMeQueryHookResult = ReturnType<typeof useGetMeQuery>;
export type GetMeLazyQueryHookResult = ReturnType<typeof useGetMeLazyQuery>;
export type GetMeSuspenseQueryHookResult = ReturnType<
  typeof useGetMeSuspenseQuery
>;
export type GetMeQueryResult = ApolloReactCommon.QueryResult<
  GetMeQuery,
  GetMeQueryVariables
>;
export const GetUserSettingsDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetUserSettings' },
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
                  name: { kind: 'Name', value: 'settings' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'theme' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'compactMode' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'showTutorials' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'autoSync' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'offlineMode' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shareUsageData' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shareWithPartners' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'personalizedAds' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'preferredUnitSystem' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'language' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'timezone' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'preferredCurrency' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'enabledFeatures' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'betaFeatures' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
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
 * __useGetUserSettingsQuery__
 *
 * To run a query within a React component, call `useGetUserSettingsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUserSettingsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUserSettingsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetUserSettingsQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetUserSettingsQuery,
    GetUserSettingsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetUserSettingsQuery,
    GetUserSettingsQueryVariables
  >(GetUserSettingsDocument, options);
}
export function useGetUserSettingsLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetUserSettingsQuery,
    GetUserSettingsQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetUserSettingsQuery,
    GetUserSettingsQueryVariables
  >(GetUserSettingsDocument, options);
}
// @ts-ignore
export function useGetUserSettingsSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetUserSettingsQuery,
    GetUserSettingsQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetUserSettingsQuery,
  GetUserSettingsQueryVariables
>;
export function useGetUserSettingsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetUserSettingsQuery,
        GetUserSettingsQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetUserSettingsQuery | undefined,
  GetUserSettingsQueryVariables
>;
export function useGetUserSettingsSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetUserSettingsQuery,
        GetUserSettingsQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetUserSettingsQuery,
    GetUserSettingsQueryVariables
  >(GetUserSettingsDocument, options);
}
export type GetUserSettingsQueryHookResult = ReturnType<
  typeof useGetUserSettingsQuery
>;
export type GetUserSettingsLazyQueryHookResult = ReturnType<
  typeof useGetUserSettingsLazyQuery
>;
export type GetUserSettingsSuspenseQueryHookResult = ReturnType<
  typeof useGetUserSettingsSuspenseQuery
>;
export type GetUserSettingsQueryResult = ApolloReactCommon.QueryResult<
  GetUserSettingsQuery,
  GetUserSettingsQueryVariables
>;
export const GetUserProfileDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetUserProfile' },
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
                  name: { kind: 'Name', value: 'profile' },
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
                        name: { kind: 'Name', value: 'firstName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'coverImage' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'phone' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'website' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dateOfBirth' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'gender' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'profileVisibility' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'showEmail' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'showPhone' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
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
 * __useGetUserProfileQuery__
 *
 * To run a query within a React component, call `useGetUserProfileQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetUserProfileQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetUserProfileQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetUserProfileQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    GetUserProfileQuery,
    GetUserProfileQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    GetUserProfileQuery,
    GetUserProfileQueryVariables
  >(GetUserProfileDocument, options);
}
export function useGetUserProfileLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    GetUserProfileQuery,
    GetUserProfileQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    GetUserProfileQuery,
    GetUserProfileQueryVariables
  >(GetUserProfileDocument, options);
}
// @ts-ignore
export function useGetUserProfileSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    GetUserProfileQuery,
    GetUserProfileQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetUserProfileQuery,
  GetUserProfileQueryVariables
>;
export function useGetUserProfileSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetUserProfileQuery,
        GetUserProfileQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  GetUserProfileQuery | undefined,
  GetUserProfileQueryVariables
>;
export function useGetUserProfileSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        GetUserProfileQuery,
        GetUserProfileQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    GetUserProfileQuery,
    GetUserProfileQueryVariables
  >(GetUserProfileDocument, options);
}
export type GetUserProfileQueryHookResult = ReturnType<
  typeof useGetUserProfileQuery
>;
export type GetUserProfileLazyQueryHookResult = ReturnType<
  typeof useGetUserProfileLazyQuery
>;
export type GetUserProfileSuspenseQueryHookResult = ReturnType<
  typeof useGetUserProfileSuspenseQuery
>;
export type GetUserProfileQueryResult = ApolloReactCommon.QueryResult<
  GetUserProfileQuery,
  GetUserProfileQueryVariables
>;
export const CanDeleteAccountDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'CanDeleteAccount' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'canDeleteAccount' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'canDelete' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'blockers' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'type' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'resourceId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'resourceName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'message' },
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
 * __useCanDeleteAccountQuery__
 *
 * To run a query within a React component, call `useCanDeleteAccountQuery` and pass it any options that fit your needs.
 * When your component renders, `useCanDeleteAccountQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useCanDeleteAccountQuery({
 *   variables: {
 *   },
 * });
 */
export function useCanDeleteAccountQuery(
  baseOptions?: ApolloReactHooks.QueryHookOptions<
    CanDeleteAccountQuery,
    CanDeleteAccountQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useQuery<
    CanDeleteAccountQuery,
    CanDeleteAccountQueryVariables
  >(CanDeleteAccountDocument, options);
}
export function useCanDeleteAccountLazyQuery(
  baseOptions?: ApolloReactHooks.LazyQueryHookOptions<
    CanDeleteAccountQuery,
    CanDeleteAccountQueryVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useLazyQuery<
    CanDeleteAccountQuery,
    CanDeleteAccountQueryVariables
  >(CanDeleteAccountDocument, options);
}
// @ts-ignore
export function useCanDeleteAccountSuspenseQuery(
  baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<
    CanDeleteAccountQuery,
    CanDeleteAccountQueryVariables
  >,
): ApolloReactHooks.UseSuspenseQueryResult<
  CanDeleteAccountQuery,
  CanDeleteAccountQueryVariables
>;
export function useCanDeleteAccountSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        CanDeleteAccountQuery,
        CanDeleteAccountQueryVariables
      >,
): ApolloReactHooks.UseSuspenseQueryResult<
  CanDeleteAccountQuery | undefined,
  CanDeleteAccountQueryVariables
>;
export function useCanDeleteAccountSuspenseQuery(
  baseOptions?:
    | ApolloReactHooks.SkipToken
    | ApolloReactHooks.SuspenseQueryHookOptions<
        CanDeleteAccountQuery,
        CanDeleteAccountQueryVariables
      >,
) {
  const options =
    baseOptions === ApolloReactHooks.skipToken
      ? baseOptions
      : { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSuspenseQuery<
    CanDeleteAccountQuery,
    CanDeleteAccountQueryVariables
  >(CanDeleteAccountDocument, options);
}
export type CanDeleteAccountQueryHookResult = ReturnType<
  typeof useCanDeleteAccountQuery
>;
export type CanDeleteAccountLazyQueryHookResult = ReturnType<
  typeof useCanDeleteAccountLazyQuery
>;
export type CanDeleteAccountSuspenseQueryHookResult = ReturnType<
  typeof useCanDeleteAccountSuspenseQuery
>;
export type CanDeleteAccountQueryResult = ApolloReactCommon.QueryResult<
  CanDeleteAccountQuery,
  CanDeleteAccountQueryVariables
>;
export const UpdateUserDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateUser' },
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
              name: { kind: 'Name', value: 'UpdateUserInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateUser' },
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
                  name: { kind: 'Name', value: 'user' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'emailVerified' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'onBoarded' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'timezone' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'preferredCurrency' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'language' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'defaultShoppingListId' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'defaultHomeId' },
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
                        name: { kind: 'Name', value: 'lastActiveAt' },
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
 * __useUpdateUserMutation__
 *
 * To run a mutation, you first call `useUpdateUserMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateUserMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateUserMutation, { data, loading, error }] = useUpdateUserMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateUserMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateUserMutation,
    UpdateUserMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateUserMutation,
    UpdateUserMutationVariables
  >(UpdateUserDocument, options);
}
export type UpdateUserMutationHookResult = ReturnType<
  typeof useUpdateUserMutation
>;
export type UpdateUserMutationResult =
  ApolloReactCommon.MutationResult<UpdateUserMutation>;
export type UpdateUserMutationOptions = ApolloReactCommon.BaseMutationOptions<
  UpdateUserMutation,
  UpdateUserMutationVariables
>;
export const UpdateUserProfileDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateUserProfile' },
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
              name: { kind: 'Name', value: 'UpdateUserProfileInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateProfile' },
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
                  name: { kind: 'Name', value: 'userProfile' },
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
                        name: { kind: 'Name', value: 'firstName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'coverImage' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'phone' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'website' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dateOfBirth' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'gender' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'profileVisibility' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'showEmail' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'showPhone' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
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
 * __useUpdateUserProfileMutation__
 *
 * To run a mutation, you first call `useUpdateUserProfileMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateUserProfileMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateUserProfileMutation, { data, loading, error }] = useUpdateUserProfileMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateUserProfileMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateUserProfileMutation,
    UpdateUserProfileMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateUserProfileMutation,
    UpdateUserProfileMutationVariables
  >(UpdateUserProfileDocument, options);
}
export type UpdateUserProfileMutationHookResult = ReturnType<
  typeof useUpdateUserProfileMutation
>;
export type UpdateUserProfileMutationResult =
  ApolloReactCommon.MutationResult<UpdateUserProfileMutation>;
export type UpdateUserProfileMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateUserProfileMutation,
    UpdateUserProfileMutationVariables
  >;
export const UpdateUserPreferencesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'UpdateUserPreferences' },
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
              name: { kind: 'Name', value: 'UpdateUserSettingsInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'updateSettings' },
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
                  name: { kind: 'Name', value: 'userSettings' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
                      { kind: 'Field', name: { kind: 'Name', value: 'theme' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'compactMode' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'showTutorials' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'autoSync' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'offlineMode' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shareUsageData' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'shareWithPartners' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'personalizedAds' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'preferredUnitSystem' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'language' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'timezone' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'preferredCurrency' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'enabledFeatures' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'betaFeatures' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'createdAt' },
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
 * __useUpdateUserPreferencesMutation__
 *
 * To run a mutation, you first call `useUpdateUserPreferencesMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateUserPreferencesMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateUserPreferencesMutation, { data, loading, error }] = useUpdateUserPreferencesMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateUserPreferencesMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    UpdateUserPreferencesMutation,
    UpdateUserPreferencesMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    UpdateUserPreferencesMutation,
    UpdateUserPreferencesMutationVariables
  >(UpdateUserPreferencesDocument, options);
}
export type UpdateUserPreferencesMutationHookResult = ReturnType<
  typeof useUpdateUserPreferencesMutation
>;
export type UpdateUserPreferencesMutationResult =
  ApolloReactCommon.MutationResult<UpdateUserPreferencesMutation>;
export type UpdateUserPreferencesMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    UpdateUserPreferencesMutation,
    UpdateUserPreferencesMutationVariables
  >;
export const DeleteAccountDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'DeleteAccount' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'deleteAccount' },
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
 * __useDeleteAccountMutation__
 *
 * To run a mutation, you first call `useDeleteAccountMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteAccountMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteAccountMutation, { data, loading, error }] = useDeleteAccountMutation({
 *   variables: {
 *   },
 * });
 */
export function useDeleteAccountMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    DeleteAccountMutation,
    DeleteAccountMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    DeleteAccountMutation,
    DeleteAccountMutationVariables
  >(DeleteAccountDocument, options);
}
export type DeleteAccountMutationHookResult = ReturnType<
  typeof useDeleteAccountMutation
>;
export type DeleteAccountMutationResult =
  ApolloReactCommon.MutationResult<DeleteAccountMutation>;
export type DeleteAccountMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    DeleteAccountMutation,
    DeleteAccountMutationVariables
  >;
export const CompleteOnboardingDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'CompleteOnboarding' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'completeOnboarding' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'success' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'code' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'user' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'AuthUser' },
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
      name: { kind: 'Name', value: 'AuthUser' },
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
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useCompleteOnboardingMutation__
 *
 * To run a mutation, you first call `useCompleteOnboardingMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCompleteOnboardingMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [completeOnboardingMutation, { data, loading, error }] = useCompleteOnboardingMutation({
 *   variables: {
 *   },
 * });
 */
export function useCompleteOnboardingMutation(
  baseOptions?: ApolloReactHooks.MutationHookOptions<
    CompleteOnboardingMutation,
    CompleteOnboardingMutationVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useMutation<
    CompleteOnboardingMutation,
    CompleteOnboardingMutationVariables
  >(CompleteOnboardingDocument, options);
}
export type CompleteOnboardingMutationHookResult = ReturnType<
  typeof useCompleteOnboardingMutation
>;
export type CompleteOnboardingMutationResult =
  ApolloReactCommon.MutationResult<CompleteOnboardingMutation>;
export type CompleteOnboardingMutationOptions =
  ApolloReactCommon.BaseMutationOptions<
    CompleteOnboardingMutation,
    CompleteOnboardingMutationVariables
  >;
export const UserChangesDocument = /*#__PURE__*/ {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'subscription',
      name: { kind: 'Name', value: 'UserChanges' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'userId' },
          },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'userChanged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'userId' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'userId' },
                },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'changeType' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'user' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'emailVerified' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'role' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'onBoarded' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'timezone' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'preferredCurrency' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'language' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastActiveAt' },
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
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'firstName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'lastName' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'displayName' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'bio' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'avatar' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'coverImage' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'phone' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'website' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'profileVisibility' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'updatedFields' },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
                { kind: 'Field', name: { kind: 'Name', value: 'userId' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode;

/**
 * __useUserChangesSubscription__
 *
 * To run a query within a React component, call `useUserChangesSubscription` and pass it any options that fit your needs.
 * When your component renders, `useUserChangesSubscription` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the subscription, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useUserChangesSubscription({
 *   variables: {
 *      userId: // value for 'userId'
 *   },
 * });
 */
export function useUserChangesSubscription(
  baseOptions?: ApolloReactHooks.SubscriptionHookOptions<
    UserChangesSubscription,
    UserChangesSubscriptionVariables
  >,
) {
  const options = { ...defaultOptions, ...baseOptions };
  return ApolloReactHooks.useSubscription<
    UserChangesSubscription,
    UserChangesSubscriptionVariables
  >(UserChangesDocument, options);
}
export type UserChangesSubscriptionHookResult = ReturnType<
  typeof useUserChangesSubscription
>;
export type UserChangesSubscriptionResult =
  ApolloReactCommon.SubscriptionResult<UserChangesSubscription>;
