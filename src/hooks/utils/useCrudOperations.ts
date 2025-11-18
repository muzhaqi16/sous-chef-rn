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

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import { DocumentNode } from 'graphql';
import { serializeError } from '#/utils/errorSerialization';
import {
  handleVersionConflictAlert,
  handleMutationErrorAlert,
} from '#/utils/errorHandlers';

/**
 * Configuration for create operation
 */
export interface CreateOperationConfig<TInput, TResult> {
  mutation: (variables: any) => Promise<{ data?: TResult }>;
  parentId?: string | null | (() => string | null | undefined);
  transformInput?: (input: TInput) => any;
  validateInput?: (input: TInput) => boolean | string;
  onSuccess?: (data: TResult) => void;
  onError?: (error: any) => void;
  operationName?: string;
}

/**
 * Configuration for update operation
 */
export interface UpdateOperationConfig<TInput, TResult> {
  mutation: (variables: any) => Promise<{ data?: TResult }>;
  parentId?: string | null | (() => string | null | undefined);
  itemId: string;
  transformInput?: (input: TInput) => any;
  validateInput?: (input: TInput) => boolean | string;
  getFragmentData?: (client: any, itemId: string) => any;
  fragmentDoc?: DocumentNode;
  includeVersion?: boolean;
  onSuccess?: (data: TResult) => void;
  onError?: (error: any) => void;
  onVersionConflict?: () => void;
  operationName?: string;
}

/**
 * Configuration for remove operation
 */
export interface RemoveOperationConfig<TResult> {
  mutation: (variables: any) => Promise<{ data?: TResult }>;
  parentId?: string | null | (() => string | null | undefined);
  itemId: string;
  confirmMessage?: string;
  itemName?: string;
  onSuccess?: (data: TResult) => void;
  onError?: (error: any) => void;
  operationName?: string;
}

/**
 * Hook that provides reusable CRUD operation patterns
 */
export function useCrudOperations() {
  const client = useApolloClient();

  /**
   * Creates a generic add/create operation
   *
   * @example
   * ```typescript
   * const addItem = createAddOperation({
   *   mutation: addItemMutation,
   *   parentId: listId,
   *   transformInput: (input) => ({ listId, ...input }),
   *   validateInput: (input) => !!input.name,
   *   operationName: 'Add Item',
   * });
   *
   * const result = await addItem({ name: 'New Item' });
   * ```
   */
  const createAddOperation = useCallback(
    <TInput, TResult>(config: CreateOperationConfig<TInput, TResult>) => {
      return async (input: TInput): Promise<TResult | false> => {
        const {
          mutation,
          parentId,
          transformInput,
          validateInput,
          onSuccess,
          onError,
          operationName = 'Create Item',
        } = config;

        // Validate parent ID if required
        const resolvedParentId = typeof parentId === 'function' ? parentId() : parentId;
        if (resolvedParentId === null || resolvedParentId === undefined) {
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

        try {
          // Transform input if transformer provided
          const variables = transformInput
            ? { input: transformInput(input) }
            : { input };

          const result = await mutation({ variables });

          if (result.data) {
            onSuccess?.(result.data);
            return result.data;
          }

          Alert.alert('Error', `Failed to ${operationName.toLowerCase()}`);
          return false;
        } catch (error: any) {
          console.error(`${operationName} error:`, serializeError(error));
          onError?.(error);
          handleMutationErrorAlert(error, { operation: operationName });
          return false;
        }
      };
    },
    [],
  );

  /**
   * Creates a generic update operation with version conflict handling
   *
   * @example
   * ```typescript
   * const updateItem = createUpdateOperation({
   *   mutation: updateItemMutation,
   *   itemId: item.id,
   *   includeVersion: true,
   *   getFragmentData: (client, id) => client.readFragment({...}),
   *   transformInput: (input) => ({ ...input, version: currentVersion }),
   *   onVersionConflict: () => refetch(),
   *   operationName: 'Update Item',
   * });
   *
   * const result = await updateItem({ name: 'Updated Name' });
   * ```
   */
  const createUpdateOperation = useCallback(
    <TInput, TResult>(config: UpdateOperationConfig<TInput, TResult>) => {
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
          operationName = 'Update Item',
        } = config;

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

        try {
          // Get current data from cache if fragment provided
          let currentData: any = null;
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
              version: currentData.version,
            };
          }

          const result = await mutation({
            variables: {
              id: itemId,
              input: transformedInput,
            },
          });

          if (result.data) {
            onSuccess?.(result.data);
            return result.data;
          }

          Alert.alert('Error', `Failed to ${operationName.toLowerCase()}`);
          return false;
        } catch (error: any) {
          // Handle version conflicts
          if (
            handleVersionConflictAlert(error, {
              itemName: 'Item',
              onRefresh: onVersionConflict,
            })
          ) {
            return false;
          }

          console.error(`${operationName} error:`, error);
          onError?.(error);
          handleMutationErrorAlert(error, { operation: operationName });
          return false;
        }
      };
    },
    [client],
  );

  /**
   * Creates a generic remove/delete operation with confirmation
   *
   * @example
   * ```typescript
   * const removeItem = createRemoveOperation({
   *   mutation: removeItemMutation,
   *   itemId: item.id,
   *   confirmMessage: 'Are you sure you want to delete this item?',
   *   itemName: item.name,
   *   operationName: 'Delete Item',
   * });
   *
   * const result = await removeItem(); // Shows confirmation dialog
   * ```
   */
  const createRemoveOperation = useCallback(
    <TResult>(config: RemoveOperationConfig<TResult>) => {
      return async (): Promise<TResult | false> => {
        const {
          mutation,
          parentId,
          itemId,
          confirmMessage,
          itemName,
          onSuccess,
          onError,
          operationName = 'Delete Item',
        } = config;

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
                  onPress: () => resolve(false),
                },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    const result = await executeRemove();
                    resolve(result);
                  },
                },
              ],
            );
          });
        }

        return executeRemove();

        async function executeRemove(): Promise<TResult | false> {
          try {
            const result = await mutation({ variables: { id: itemId } });

            if (result.data) {
              onSuccess?.(result.data);
              return result.data;
            }

            Alert.alert('Error', `Failed to ${operationName.toLowerCase()}`);
            return false;
          } catch (error: any) {
            console.error(`${operationName} error:`, error);
            onError?.(error);
            handleMutationErrorAlert(error, { operation: operationName });
            return false;
          }
        }
      };
    },
    [],
  );

  /**
   * Creates a simple operation wrapper without specific CRUD logic
   * Useful for toggle, archive, or other custom operations
   *
   * @example
   * ```typescript
   * const toggleItem = createSimpleOperation({
   *   operation: async (itemId, newState) => {
   *     return await toggleMutation({ variables: { id: itemId, state: newState } });
   *   },
   *   operationName: 'Toggle Item',
   * });
   * ```
   */
  const createSimpleOperation = useCallback(
    <TArgs extends any[], TResult>(config: {
      operation: (...args: TArgs) => Promise<{ data?: TResult }>;
      validate?: (...args: TArgs) => boolean | string;
      onSuccess?: (data: TResult) => void;
      onError?: (error: any) => void;
      operationName?: string;
    }) => {
      return async (...args: TArgs): Promise<TResult | false> => {
        const {
          operation,
          validate,
          onSuccess,
          onError,
          operationName = 'Operation',
        } = config;

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

        try {
          const result = await operation(...args);

          if (result.data) {
            onSuccess?.(result.data);
            return result.data;
          }

          Alert.alert('Error', `Failed to ${operationName.toLowerCase()}`);
          return false;
        } catch (error: any) {
          console.error(`${operationName} error:`, serializeError(error));
          onError?.(error);
          handleMutationErrorAlert(error, { operation: operationName });
          return false;
        }
      };
    },
    [],
  );

  return {
    createAddOperation,
    createUpdateOperation,
    createRemoveOperation,
    createSimpleOperation,
  };
}
