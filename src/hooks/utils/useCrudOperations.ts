/**
 * CRUD Operations Utilities - Reusable patterns for Create, Read, Update, Delete
 *
 * This hook provides common CRUD operation patterns that can be reused across
 * different management hooks to reduce boilerplate and ensure consistency.
 *
 * Usage:
 * ```typescript
 * const { createAddOperation, createUpdateOperation, createRemoveOperation } = useCrudOperations();
 *
 * const addItem = createAddOperation({
 *   mutation: addItemMutation,
 *   parentId,
 *   transformInput: (input) => ({ ...input, parentId }),
 *   validateInput: (input) => !!input.name,
 *   onSuccess: () => console.log('Item added'),
 * });
 * ```
 */

import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { errorService } from '#/services/errorService';
import { executeMutationWithErrorHandler } from '#/utils/compilerSafeWrappers';
import {
  handleVersionConflictAlert,
  handleMutationErrorAlert } from '#/utils/errorHandlers';

/**
 * Configuration for create operation
 */
export interface CreateOperationConfig<TInput, TResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wraps diverse Apollo mutation signatures
  mutation: (...args: any[]) => Promise<{ data?: TResult; errors?: readonly { message: string }[] }>;
  parentId?: string | null | (() => string | null | undefined);
  transformInput?: (input: TInput) => Record<string, unknown>;
  validateInput?: (input: TInput) => boolean | string;
  onSuccess?: (data: TResult) => void;
  onError?: (error: unknown) => void;
  operationName?: string;
}

/**
 * Configuration for update operation
 */
export interface UpdateOperationConfig<TInput, TResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wraps diverse Apollo mutation signatures
  mutation: (...args: any[]) => Promise<{ data?: TResult }>;
  parentId?: string | null | (() => string | null | undefined);
  itemId: string;
  transformInput?: (input: TInput) => Record<string, unknown>;
  validateInput?: (input: TInput) => boolean | string;
  getFragmentData?: (client: ReturnType<typeof useApolloClient>, itemId: string) => { version?: number } | null;
  fragmentDoc?: DocumentNode;
  includeVersion?: boolean;
  onSuccess?: (data: TResult) => void;
  onError?: (error: unknown) => void;
  onVersionConflict?: () => void;
  operationName?: string;
}

/**
 * Configuration for remove operation
 */
export interface RemoveOperationConfig<TResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wraps diverse Apollo mutation signatures
  mutation: (...args: any[]) => Promise<{ data?: TResult }>;
  parentId?: string | null | (() => string | null | undefined);
  itemId: string;
  confirmMessage?: string;
  itemName?: string;
  onSuccess?: (data: TResult) => void;
  onError?: (error: unknown) => void;
  operationName?: string;
}

// --- Module-level factory implementations (outside hook body for React Compiler) ---

function createAddOperationImpl<TInput, TResult>(config: CreateOperationConfig<TInput, TResult>) {
  return async (input: TInput): Promise<TResult | false> => {
    const {
      mutation,
      parentId,
      transformInput,
      validateInput,
      onSuccess,
      onError,
      operationName = 'Create Item' } = config;

    // Validate parent ID only if it was explicitly provided in config
    const resolvedParentId = typeof parentId === 'function' ? parentId() : parentId;
    if (parentId !== undefined && (resolvedParentId === null || resolvedParentId === '')) {
      Alert.alert('Error', 'Parent context is required');
      return false;
    }

    // Validate input if validator provided
    if (validateInput) {
      const validation = validateInput(input);
      if (typeof validation === 'string') {
        Alert.alert('Validation Error', validation);
        return false;
      }
      if (!validation) {
        Alert.alert('Validation Error', 'Invalid input');
        return false;
      }
    }

    // Transform input if transformer provided
    const variables = transformInput
      ? { input: transformInput(input) }
      : { input };

    const result = await executeMutationWithErrorHandler(
      () => mutation({ variables }),
      (error) => {
        errorService.reportError(error, { operation: operationName });
        onError?.(error);
        handleMutationErrorAlert(error, { operation: operationName });
      },
    );

    if (!result) return false;

    // Handle GraphQL errors returned with errorPolicy: 'all'
    // Check errors FIRST because result.data may be { mutationName: null } even on error
    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors[0].message || `Failed to ${operationName.toLowerCase()}`;
      Alert.alert('Error', errorMessage);
      return false;
    }

    if (result.data) {
      onSuccess?.(result.data);
      return result.data;
    }

    Alert.alert('Error', `Failed to ${operationName.toLowerCase()}`);
    return false;
  };
}

function createUpdateOperationImpl<TInput, TResult>(
  client: ApolloClient,
  config: UpdateOperationConfig<TInput, TResult>,
) {
  return async (input: TInput): Promise<TResult | false> => {
    const {
      mutation,
      parentId,
      itemId,
      transformInput,
      validateInput,
      getFragmentData,
      includeVersion = false,
      onSuccess,
      onError,
      onVersionConflict,
      operationName = 'Update Item' } = config;

    // Validate parent ID if required
    const resolvedParentId = typeof parentId === 'function' ? parentId() : parentId;
    if (resolvedParentId !== undefined && (resolvedParentId === null || resolvedParentId === '')) {
      Alert.alert('Error', 'Parent context is required');
      return false;
    }

    // Validate input if validator provided
    if (validateInput) {
      const validation = validateInput(input);
      if (typeof validation === 'string') {
        Alert.alert('Validation Error', validation);
        return false;
      }
      if (!validation) {
        Alert.alert('Validation Error', 'Invalid input');
        return false;
      }
    }

    // Get current data from cache if fragment provided
    let currentData: { version?: number } | null = null;
    if (getFragmentData) {
      currentData = getFragmentData(client, itemId);
    }

    // Transform input
    let transformedInput = transformInput
      ? transformInput(input)
      : input;

    // Include version for optimistic concurrency control
    if (includeVersion && currentData?.version) {
      transformedInput = {
        ...transformedInput,
        version: currentData.version };
    }

    const result = await executeMutationWithErrorHandler(
      () => mutation({
        variables: {
          id: itemId,
          input: transformedInput } }),
      (error) => {
        // Handle version conflicts
        if (
          handleVersionConflictAlert(error, {
            itemName: 'Item',
            onRefresh: onVersionConflict })
        ) {
          return;
        }

        errorService.reportError(error, { operation: operationName });
        onError?.(error);
        handleMutationErrorAlert(error, { operation: operationName });
      },
    );

    if (!result) return false;

    if (result.data) {
      onSuccess?.(result.data);
      return result.data;
    }

    Alert.alert('Error', `Failed to ${operationName.toLowerCase()}`);
    return false;
  };
}

async function executeRemoveImpl<TResult>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wraps diverse Apollo mutation signatures
  mutation: (...args: any[]) => Promise<{ data?: TResult }>,
  itemId: string,
  operationName: string,
  onSuccess?: (data: TResult) => void,
  onError?: (error: unknown) => void,
): Promise<TResult | false> {
  const result = await executeMutationWithErrorHandler(
    () => mutation({ variables: { id: itemId } }),
    (error) => {
      errorService.reportError(error, { operation: operationName });
      onError?.(error);
      handleMutationErrorAlert(error, { operation: operationName });
    },
  );

  if (!result) return false;

  if (result.data) {
    onSuccess?.(result.data);
    return result.data;
  }

  Alert.alert('Error', `Failed to ${operationName.toLowerCase()}`);
  return false;
}

function createRemoveOperationImpl<TResult>(config: RemoveOperationConfig<TResult>) {
  return async (): Promise<TResult | false> => {
    const {
      mutation,
      parentId,
      itemId,
      confirmMessage,
      itemName,
      onSuccess,
      onError,
      operationName = 'Delete Item' } = config;

    // Validate parent ID if required
    const resolvedParentId = typeof parentId === 'function' ? parentId() : parentId;
    if (resolvedParentId !== undefined && (resolvedParentId === null || resolvedParentId === '')) {
      Alert.alert('Error', 'Parent context is required');
      return false;
    }

    // Show confirmation if message provided
    if (confirmMessage) {
      return new Promise(resolve => {
        Alert.alert(
          operationName,
          itemName
            ? confirmMessage.replace('{name}', itemName)
            : confirmMessage,
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false) },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                const result = await executeRemoveImpl(mutation, itemId, operationName, onSuccess, onError);
                resolve(result);
              } },
          ],
        );
      });
    }

    return executeRemoveImpl(mutation, itemId, operationName, onSuccess, onError);
  };
}

function createSimpleOperationImpl<TArgs extends unknown[], TResult>(config: {
  operation: (...args: TArgs) => Promise<{ data?: TResult }>;
  validate?: (...args: TArgs) => boolean | string;
  onSuccess?: (data: TResult) => void;
  onError?: (error: unknown) => void;
  operationName?: string;
}) {
  return async (...args: TArgs): Promise<TResult | false> => {
    const {
      operation,
      validate,
      onSuccess,
      onError,
      operationName = 'Operation' } = config;

    // Validate if validator provided
    if (validate) {
      const validation = validate(...args);
      if (typeof validation === 'string') {
        Alert.alert('Validation Error', validation);
        return false;
      }
      if (!validation) {
        Alert.alert('Validation Error', 'Invalid operation');
        return false;
      }
    }

    const result = await executeMutationWithErrorHandler(
      () => operation(...args),
      (error) => {
        errorService.reportError(error, { operation: operationName });
        onError?.(error);
        handleMutationErrorAlert(error, { operation: operationName });
      },
    );

    if (!result) return false;

    if (result.data) {
      onSuccess?.(result.data);
      return result.data;
    }

    Alert.alert('Error', `Failed to ${operationName.toLowerCase()}`);
    return false;
  };
}

/**
 * Hook that provides reusable CRUD operation patterns
 */
export function useCrudOperations() {
  const client = useApolloClient();

  return {
    createAddOperation: <TInput, TResult>(config: CreateOperationConfig<TInput, TResult>) =>
      createAddOperationImpl(config),
    createUpdateOperation: <TInput, TResult>(config: UpdateOperationConfig<TInput, TResult>) =>
      createUpdateOperationImpl(client, config),
    createRemoveOperation: <TResult>(config: RemoveOperationConfig<TResult>) =>
      createRemoveOperationImpl(config),
    createSimpleOperation: <TArgs extends unknown[], TResult>(config: {
      operation: (...args: TArgs) => Promise<{ data?: TResult }>;
      validate?: (...args: TArgs) => boolean | string;
      onSuccess?: (data: TResult) => void;
      onError?: (error: unknown) => void;
      operationName?: string;
    }) => createSimpleOperationImpl(config),
  };
}
