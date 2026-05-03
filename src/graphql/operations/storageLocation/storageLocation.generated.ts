// This file is auto-generated. Do not edit manually.
/* eslint-disable */
// @ts-nocheck
import type * as Types from '../../generated/baseTypes';

import type { DocumentNode } from 'graphql';
import type * as ApolloReactCommon from '@apollo/client';
import * as ApolloReactHooks from '@apollo/client/react';
const defaultOptions = {} as const;
export type GetStorageLocationsQueryVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
}>;


export type GetStorageLocationsQuery = { __typename: 'Query', storageLocations: { __typename: 'StorageLocationConnection', totalCount: number | null, edges: Array<{ __typename: 'StorageLocationEdge', cursor: string, node: { __typename: 'StorageLocation', id: string, name: string, type: Types.StorageType, icon: string | null, color: string | null, temperature: Types.StorageState | null, description: string | null, isClimateControlled: boolean, capacity: number | null, capacityUnit: string | null, sortOrder: number, isDefault: boolean, currentItemCount: number, parentLocation: { __typename: 'StorageLocation', id: string, name: string } | null } }>, pageInfo: { __typename: 'PageInfo', hasNextPage: boolean, endCursor: string | null } } };

export type GetStorageLocationTreeQueryVariables = Types.Exact<{
  homeId: Types.Scalars['ID']['input'];
}>;


export type GetStorageLocationTreeQuery = { __typename: 'Query', storageLocationTree: Array<{ __typename: 'StorageLocation', id: string, name: string, type: Types.StorageType, icon: string | null, color: string | null, sortOrder: number, currentItemCount: number, isDefault: boolean, childLocations: Array<{ __typename: 'StorageLocation', id: string, name: string, type: Types.StorageType, icon: string | null, color: string | null, sortOrder: number, currentItemCount: number, childLocations: Array<{ __typename: 'StorageLocation', id: string, name: string, type: Types.StorageType, currentItemCount: number }> }> }> };

export type GetStorageLocationQueryVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type GetStorageLocationQuery = { __typename: 'Query', storageLocation: { __typename: 'StorageLocation', id: string, name: string, type: Types.StorageType, icon: string | null, color: string | null, temperature: Types.StorageState | null, description: string | null, isClimateControlled: boolean, capacity: number | null, capacityUnit: string | null, sortOrder: number, isDefault: boolean, currentItemCount: number, parentLocation: { __typename: 'StorageLocation', id: string, name: string } | null, childLocations: Array<{ __typename: 'StorageLocation', id: string, name: string, type: Types.StorageType }> } | null };

export type CreateStorageLocationMutationVariables = Types.Exact<{
  input: Types.CreateStorageLocationInput;
}>;


export type CreateStorageLocationMutation = { __typename: 'Mutation', createStorageLocation: { __typename: 'StorageLocationPayload', success: boolean, message: string, code: string, storageLocation: { __typename: 'StorageLocation', id: string, name: string, type: Types.StorageType, icon: string | null, color: string | null, temperature: Types.StorageState | null, description: string | null, isClimateControlled: boolean, capacity: number | null, capacityUnit: string | null, sortOrder: number, isDefault: boolean, currentItemCount: number, homeId: string, parentLocation: { __typename: 'StorageLocation', id: string, name: string } | null } | null } };

export type UpdateStorageLocationMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
  input: Types.UpdateStorageLocationInput;
}>;


export type UpdateStorageLocationMutation = { __typename: 'Mutation', updateStorageLocation: { __typename: 'StorageLocationPayload', success: boolean, message: string, code: string, storageLocation: { __typename: 'StorageLocation', id: string, name: string, type: Types.StorageType, icon: string | null, color: string | null, temperature: Types.StorageState | null, description: string | null, isClimateControlled: boolean, capacity: number | null, capacityUnit: string | null, sortOrder: number, isDefault: boolean, currentItemCount: number, parentLocationId: string | null } | null } };

export type DeleteStorageLocationMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type DeleteStorageLocationMutation = { __typename: 'Mutation', deleteStorageLocation: { __typename: 'StorageLocationPayload', success: boolean, message: string, code: string, storageLocation: { __typename: 'StorageLocation', id: string } | null } };

export type SetDefaultStorageLocationMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']['input'];
}>;


export type SetDefaultStorageLocationMutation = { __typename: 'Mutation', setDefaultStorageLocation: { __typename: 'StorageLocationPayload', success: boolean, message: string, code: string, storageLocation: { __typename: 'StorageLocation', id: string, name: string, isDefault: boolean } | null } };


export const GetStorageLocationsDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStorageLocations"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"homeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"storageLocations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"homeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"homeId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"temperature"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isClimateControlled"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"capacityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}},{"kind":"Field","name":{"kind":"Name","value":"currentItemCount"}},{"kind":"Field","name":{"kind":"Name","value":"parentLocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"cursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"totalCount"}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useGetStorageLocationsQuery__
 *
 * To run a query within a React component, call `useGetStorageLocationsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStorageLocationsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStorageLocationsQuery({
 *   variables: {
 *      homeId: // value for 'homeId'
 *   },
 * });
 */
export function useGetStorageLocationsQuery(baseOptions: ApolloReactHooks.QueryHookOptions<GetStorageLocationsQuery, GetStorageLocationsQueryVariables> & ({ variables: GetStorageLocationsQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetStorageLocationsQuery, GetStorageLocationsQueryVariables>(GetStorageLocationsDocument, options);
      }
export function useGetStorageLocationsLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetStorageLocationsQuery, GetStorageLocationsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetStorageLocationsQuery, GetStorageLocationsQueryVariables>(GetStorageLocationsDocument, options);
        }
// @ts-ignore
export function useGetStorageLocationsSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetStorageLocationsQuery, GetStorageLocationsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetStorageLocationsQuery, GetStorageLocationsQueryVariables>;
export function useGetStorageLocationsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetStorageLocationsQuery, GetStorageLocationsQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetStorageLocationsQuery | undefined, GetStorageLocationsQueryVariables>;
export function useGetStorageLocationsSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetStorageLocationsQuery, GetStorageLocationsQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetStorageLocationsQuery, GetStorageLocationsQueryVariables>(GetStorageLocationsDocument, options);
        }
export type GetStorageLocationsQueryHookResult = ReturnType<typeof useGetStorageLocationsQuery>;
export type GetStorageLocationsLazyQueryHookResult = ReturnType<typeof useGetStorageLocationsLazyQuery>;
export type GetStorageLocationsSuspenseQueryHookResult = ReturnType<typeof useGetStorageLocationsSuspenseQuery>;
export type GetStorageLocationsQueryResult = ApolloReactCommon.QueryResult<GetStorageLocationsQuery, GetStorageLocationsQueryVariables>;
export const GetStorageLocationTreeDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStorageLocationTree"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"homeId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"storageLocationTree"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"homeId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"homeId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"currentItemCount"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}},{"kind":"Field","name":{"kind":"Name","value":"childLocations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"currentItemCount"}},{"kind":"Field","name":{"kind":"Name","value":"childLocations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"currentItemCount"}}]}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useGetStorageLocationTreeQuery__
 *
 * To run a query within a React component, call `useGetStorageLocationTreeQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStorageLocationTreeQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStorageLocationTreeQuery({
 *   variables: {
 *      homeId: // value for 'homeId'
 *   },
 * });
 */
export function useGetStorageLocationTreeQuery(baseOptions: ApolloReactHooks.QueryHookOptions<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables> & ({ variables: GetStorageLocationTreeQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables>(GetStorageLocationTreeDocument, options);
      }
export function useGetStorageLocationTreeLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables>(GetStorageLocationTreeDocument, options);
        }
// @ts-ignore
export function useGetStorageLocationTreeSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables>;
export function useGetStorageLocationTreeSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetStorageLocationTreeQuery | undefined, GetStorageLocationTreeQueryVariables>;
export function useGetStorageLocationTreeSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables>(GetStorageLocationTreeDocument, options);
        }
export type GetStorageLocationTreeQueryHookResult = ReturnType<typeof useGetStorageLocationTreeQuery>;
export type GetStorageLocationTreeLazyQueryHookResult = ReturnType<typeof useGetStorageLocationTreeLazyQuery>;
export type GetStorageLocationTreeSuspenseQueryHookResult = ReturnType<typeof useGetStorageLocationTreeSuspenseQuery>;
export type GetStorageLocationTreeQueryResult = ApolloReactCommon.QueryResult<GetStorageLocationTreeQuery, GetStorageLocationTreeQueryVariables>;
export const GetStorageLocationDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetStorageLocation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"storageLocation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"temperature"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isClimateControlled"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"capacityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}},{"kind":"Field","name":{"kind":"Name","value":"currentItemCount"}},{"kind":"Field","name":{"kind":"Name","value":"parentLocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"childLocations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useGetStorageLocationQuery__
 *
 * To run a query within a React component, call `useGetStorageLocationQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetStorageLocationQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetStorageLocationQuery({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useGetStorageLocationQuery(baseOptions: ApolloReactHooks.QueryHookOptions<GetStorageLocationQuery, GetStorageLocationQueryVariables> & ({ variables: GetStorageLocationQueryVariables; skip?: boolean; } | { skip: boolean; }) ) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useQuery<GetStorageLocationQuery, GetStorageLocationQueryVariables>(GetStorageLocationDocument, options);
      }
export function useGetStorageLocationLazyQuery(baseOptions?: ApolloReactHooks.LazyQueryHookOptions<GetStorageLocationQuery, GetStorageLocationQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useLazyQuery<GetStorageLocationQuery, GetStorageLocationQueryVariables>(GetStorageLocationDocument, options);
        }
// @ts-ignore
export function useGetStorageLocationSuspenseQuery(baseOptions?: ApolloReactHooks.SuspenseQueryHookOptions<GetStorageLocationQuery, GetStorageLocationQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetStorageLocationQuery, GetStorageLocationQueryVariables>;
export function useGetStorageLocationSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetStorageLocationQuery, GetStorageLocationQueryVariables>): ApolloReactHooks.UseSuspenseQueryResult<GetStorageLocationQuery | undefined, GetStorageLocationQueryVariables>;
export function useGetStorageLocationSuspenseQuery(baseOptions?: ApolloReactHooks.SkipToken | ApolloReactHooks.SuspenseQueryHookOptions<GetStorageLocationQuery, GetStorageLocationQueryVariables>) {
          const options = baseOptions === ApolloReactHooks.skipToken ? baseOptions : {...defaultOptions, ...baseOptions}
          return ApolloReactHooks.useSuspenseQuery<GetStorageLocationQuery, GetStorageLocationQueryVariables>(GetStorageLocationDocument, options);
        }
export type GetStorageLocationQueryHookResult = ReturnType<typeof useGetStorageLocationQuery>;
export type GetStorageLocationLazyQueryHookResult = ReturnType<typeof useGetStorageLocationLazyQuery>;
export type GetStorageLocationSuspenseQueryHookResult = ReturnType<typeof useGetStorageLocationSuspenseQuery>;
export type GetStorageLocationQueryResult = ApolloReactCommon.QueryResult<GetStorageLocationQuery, GetStorageLocationQueryVariables>;
export const CreateStorageLocationDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateStorageLocation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateStorageLocationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createStorageLocation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"storageLocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"temperature"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isClimateControlled"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"capacityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}},{"kind":"Field","name":{"kind":"Name","value":"currentItemCount"}},{"kind":"Field","name":{"kind":"Name","value":"homeId"}},{"kind":"Field","name":{"kind":"Name","value":"parentLocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useCreateStorageLocationMutation__
 *
 * To run a mutation, you first call `useCreateStorageLocationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useCreateStorageLocationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [createStorageLocationMutation, { data, loading, error }] = useCreateStorageLocationMutation({
 *   variables: {
 *      input: // value for 'input'
 *   },
 * });
 */
export function useCreateStorageLocationMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<CreateStorageLocationMutation, CreateStorageLocationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<CreateStorageLocationMutation, CreateStorageLocationMutationVariables>(CreateStorageLocationDocument, options);
      }
export type CreateStorageLocationMutationHookResult = ReturnType<typeof useCreateStorageLocationMutation>;
export type CreateStorageLocationMutationResult = ApolloReactCommon.MutationResult<CreateStorageLocationMutation>;
export type CreateStorageLocationMutationOptions = ApolloReactCommon.BaseMutationOptions<CreateStorageLocationMutation, CreateStorageLocationMutationVariables>;
export const UpdateStorageLocationDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateStorageLocation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateStorageLocationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateStorageLocation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"storageLocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"temperature"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isClimateControlled"}},{"kind":"Field","name":{"kind":"Name","value":"capacity"}},{"kind":"Field","name":{"kind":"Name","value":"capacityUnit"}},{"kind":"Field","name":{"kind":"Name","value":"sortOrder"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}},{"kind":"Field","name":{"kind":"Name","value":"currentItemCount"}},{"kind":"Field","name":{"kind":"Name","value":"parentLocationId"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useUpdateStorageLocationMutation__
 *
 * To run a mutation, you first call `useUpdateStorageLocationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useUpdateStorageLocationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [updateStorageLocationMutation, { data, loading, error }] = useUpdateStorageLocationMutation({
 *   variables: {
 *      id: // value for 'id'
 *      input: // value for 'input'
 *   },
 * });
 */
export function useUpdateStorageLocationMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<UpdateStorageLocationMutation, UpdateStorageLocationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<UpdateStorageLocationMutation, UpdateStorageLocationMutationVariables>(UpdateStorageLocationDocument, options);
      }
export type UpdateStorageLocationMutationHookResult = ReturnType<typeof useUpdateStorageLocationMutation>;
export type UpdateStorageLocationMutationResult = ApolloReactCommon.MutationResult<UpdateStorageLocationMutation>;
export type UpdateStorageLocationMutationOptions = ApolloReactCommon.BaseMutationOptions<UpdateStorageLocationMutation, UpdateStorageLocationMutationVariables>;
export const DeleteStorageLocationDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteStorageLocation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteStorageLocation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"storageLocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useDeleteStorageLocationMutation__
 *
 * To run a mutation, you first call `useDeleteStorageLocationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useDeleteStorageLocationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [deleteStorageLocationMutation, { data, loading, error }] = useDeleteStorageLocationMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useDeleteStorageLocationMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<DeleteStorageLocationMutation, DeleteStorageLocationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<DeleteStorageLocationMutation, DeleteStorageLocationMutationVariables>(DeleteStorageLocationDocument, options);
      }
export type DeleteStorageLocationMutationHookResult = ReturnType<typeof useDeleteStorageLocationMutation>;
export type DeleteStorageLocationMutationResult = ApolloReactCommon.MutationResult<DeleteStorageLocationMutation>;
export type DeleteStorageLocationMutationOptions = ApolloReactCommon.BaseMutationOptions<DeleteStorageLocationMutation, DeleteStorageLocationMutationVariables>;
export const SetDefaultStorageLocationDocument = /*#__PURE__*/ {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetDefaultStorageLocation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setDefaultStorageLocation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"success"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"storageLocation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}}]}}]}}]} as unknown as DocumentNode;

/**
 * __useSetDefaultStorageLocationMutation__
 *
 * To run a mutation, you first call `useSetDefaultStorageLocationMutation` within a React component and pass it any options that fit your needs.
 * When your component renders, `useSetDefaultStorageLocationMutation` returns a tuple that includes:
 * - A mutate function that you can call at any time to execute the mutation
 * - An object with fields that represent the current status of the mutation's execution
 *
 * @param baseOptions options that will be passed into the mutation, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options-2;
 *
 * @example
 * const [setDefaultStorageLocationMutation, { data, loading, error }] = useSetDefaultStorageLocationMutation({
 *   variables: {
 *      id: // value for 'id'
 *   },
 * });
 */
export function useSetDefaultStorageLocationMutation(baseOptions?: ApolloReactHooks.MutationHookOptions<SetDefaultStorageLocationMutation, SetDefaultStorageLocationMutationVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return ApolloReactHooks.useMutation<SetDefaultStorageLocationMutation, SetDefaultStorageLocationMutationVariables>(SetDefaultStorageLocationDocument, options);
      }
export type SetDefaultStorageLocationMutationHookResult = ReturnType<typeof useSetDefaultStorageLocationMutation>;
export type SetDefaultStorageLocationMutationResult = ApolloReactCommon.MutationResult<SetDefaultStorageLocationMutation>;
export type SetDefaultStorageLocationMutationOptions = ApolloReactCommon.BaseMutationOptions<SetDefaultStorageLocationMutation, SetDefaultStorageLocationMutationVariables>;