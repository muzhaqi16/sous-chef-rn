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

import { alertService } from '#/services/alertService';
import { useApolloClient } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { errorService } from '#/services/errorService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import {
  handleVersionConflictAlert,
  handleMutationErrorAlert,
  alertVersionConflict,
} from '#/utils/errorHandlers';
import { findConflictDataMember } from '#/utils/errors/versionConflict';
import { t } from '#/i18n/t';

/**
 * Surface a resolved errors-as-data member from a mutation `data` payload.
 *
 * These CRUD helpers are type-erased (they don't know the success typename), so
 * unlike call sites they can't use `classifyCreateResult`. Detect the `*Error`
 * union member by its typename suffix — under `errorPolicy:'all'` it resolves as
 * truthy `data` and would otherwise be treated as success. Returns true (and
 * alerts + reports) when an error was surfaced.
 */
function surfaceCrudDataError(data: unknown, operationName: string): boolean {
  if (!data || typeof data !== 'object') return false;
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as { __typename?: unknown }).__typename === 'string' &&
      (value as { __typename: string }).__typename.endsWith('Error')
    ) {
      const raw = (value as { message?: unknown }).message;
      const message =
        typeof raw === 'string' && raw.length > 0
          ? raw
          : t('errors.somethingWentWrong');
      alertService.alert(t('labels.error'), message);
      errorService.reportError(new Error(`${operationName}: ${message}`), {
        operation: operationName,
      });
      return true;
    }
  }
  return false;
}

/**
 * Resolved value these CRUD helpers read off an Apollo mutate call — `data`
 * plus, under `errorPolicy: 'all'`, an `errors` array.
 */
type MutateResultLike<TResult> = {
  data?: TResult | null;
  errors?: readonly { message: string }[];
};

/**
 * Minimal Apollo mutate option shape. The config interfaces declare `mutation`
 * as a **method** so the parameter is checked bivariantly: this lets a mutate
 * function returned by `useMutation()[0]` (which has strongly-typed,
 * operation-specific required variables) stay assignable, while these helpers
 * invoke it with a dynamically-built `{ variables }` record. A full
 * `MutationFunctionOptions<TResult, …>` would be too strict to accept both.
 */
type MutateOptions = { variables?: Record<string, unknown> };

/**
 * Configuration for create operation
 */
export interface CreateOperationConfig<TInput, TResult> {
  mutation(options: MutateOptions): Promise<MutateResultLike<TResult>>;
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
  mutation(options: MutateOptions): Promise<MutateResultLike<TResult>>;
  parentId?: string | null | (() => string | null | undefined);
  itemId: string;
  transformInput?: (input: TInput) => Record<string, unknown>;
  validateInput?: (input: TInput) => boolean | string;
  getFragmentData?: (
    client: ReturnType<typeof useApolloClient>,
    itemId: string,
  ) => { version?: number } | null;
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
  mutation(options: MutateOptions): Promise<MutateResultLike<TResult>>;
  parentId?: string | null | (() => string | null | undefined);
  itemId: string;
  confirmMessage?: string;
  itemName?: string;
  onSuccess?: (data: TResult) => void;
  onError?: (error: unknown) => void;
  operationName?: string;
}

// --- Module-level factory implementations (outside hook body for React Compiler) ---

function createAddOperationImpl<TInput, TResult>(
  config: CreateOperationConfig<TInput, TResult>,
) {
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

    // Validate parent ID only if it was explicitly provided in config
    const resolvedParentId =
      typeof parentId === 'function' ? parentId() : parentId;
    if (
      parentId !== undefined &&
      (resolvedParentId == null || resolvedParentId === '')
    ) {
      alertService.alert(t('labels.error'), t('errors.parentContextRequired'));
      return false;
    }

    // Validate input if validator provided
    if (validateInput) {
      const validation = validateInput(input);
      if (typeof validation === 'string') {
        alertService.alert(t('labels.validationError'), validation);
        return false;
      }
      if (!validation) {
        alertService.alert(
          t('labels.validationError'),
          t('errors.invalidInput'),
        );
        return false;
      }
    }

    // Transform input if transformer provided
    const variables = transformInput
      ? { input: transformInput(input) }
      : { input };

    const result = await executeMutation(
      () => mutation({ variables }),
      error => {
        errorService.reportError(error, { operation: operationName });
        onError?.(error);
        handleMutationErrorAlert(error, { operation: operationName });
      },
    );

    if (!result) return false;

    // Handle GraphQL errors returned with errorPolicy: 'all'
    // Check errors FIRST because result.data may be { mutationName: null } even on error
    if (result.errors && result.errors.length > 0) {
      const errorMessage =
        result.errors[0].message || t('errors.somethingWentWrong');
      alertService.alert(t('labels.error'), errorMessage);
      return false;
    }

    if (surfaceCrudDataError(result.data, operationName)) {
      onError?.(new Error(operationName));
      return false;
    }

    if (result.data) {
      onSuccess?.(result.data);
      return result.data;
    }

    alertService.alert(t('labels.error'), t('errors.somethingWentWrong'));
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
      operationName = 'Update Item',
    } = config;

    // Validate parent ID if required
    const resolvedParentId =
      typeof parentId === 'function' ? parentId() : parentId;
    if (
      resolvedParentId !== undefined &&
      (resolvedParentId == null || resolvedParentId === '')
    ) {
      alertService.alert(t('labels.error'), t('errors.parentContextRequired'));
      return false;
    }

    // Validate input if validator provided
    if (validateInput) {
      const validation = validateInput(input);
      if (typeof validation === 'string') {
        alertService.alert(t('labels.validationError'), validation);
        return false;
      }
      if (!validation) {
        alertService.alert(
          t('labels.validationError'),
          t('errors.invalidInput'),
        );
        return false;
      }
    }

    // Get current data from cache if fragment provided
    let currentData: { version?: number } | null = null;
    if (getFragmentData) {
      currentData = getFragmentData(client, itemId);
    }

    // Transform input
    let transformedInput = transformInput ? transformInput(input) : input;

    // Include version for optimistic concurrency control
    if (includeVersion && currentData?.version) {
      transformedInput = {
        ...transformedInput,
        version: currentData.version,
      };
    }

    const result = await executeMutation(
      () =>
        mutation({
          variables: {
            input: { id: itemId, ...transformedInput },
          },
        }),
      error => {
        // Handle version conflicts
        if (
          handleVersionConflictAlert(error, {
            itemName: 'Item',
            onRefresh: onVersionConflict,
          })
        ) {
          return;
        }

        errorService.reportError(error, { operation: operationName });
        onError?.(error);
        handleMutationErrorAlert(error, { operation: operationName });
      },
    );

    if (!result) return false;

    // A ConflictError resolved as an errors-as-data union member routes to the
    // version-conflict refresh UX, not the generic alert. The thrown-error
    // branch in `onError` above only fires when Apollo throws, which
    // `errorPolicy: 'all'` avoids — so without this the Refresh action is
    // unreachable for the data-member shape the schema actually returns.
    const conflict = findConflictDataMember(result.data);
    if (conflict) {
      alertVersionConflict({
        onRefresh: onVersionConflict,
        customMessage: conflict.message ?? undefined,
      });
      onError?.(new Error(`${operationName}: conflict`));
      return false;
    }

    if (surfaceCrudDataError(result.data, operationName)) {
      onError?.(new Error(operationName));
      return false;
    }

    if (result.data) {
      onSuccess?.(result.data);
      return result.data;
    }

    alertService.alert(t('labels.error'), t('errors.somethingWentWrong'));
    return false;
  };
}

async function executeRemoveImpl<TResult>(
  mutation: (options: MutateOptions) => Promise<MutateResultLike<TResult>>,
  itemId: string,
  operationName: string,
  onSuccess?: (data: TResult) => void,
  onError?: (error: unknown) => void,
): Promise<TResult | false> {
  const result = await executeMutation(
    () => mutation({ variables: { input: { id: itemId } } }),
    error => {
      errorService.reportError(error, { operation: operationName });
      onError?.(error);
      handleMutationErrorAlert(error, { operation: operationName });
    },
  );

  if (!result) return false;

  if (surfaceCrudDataError(result.data, operationName)) {
    onError?.(new Error(operationName));
    return false;
  }

  if (result.data) {
    onSuccess?.(result.data);
    return result.data;
  }

  alertService.alert('Error', `Failed to ${operationName.toLowerCase()}`);
  return false;
}

function createRemoveOperationImpl<TResult>(
  config: RemoveOperationConfig<TResult>,
) {
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
    const resolvedParentId =
      typeof parentId === 'function' ? parentId() : parentId;
    if (
      resolvedParentId !== undefined &&
      (resolvedParentId == null || resolvedParentId === '')
    ) {
      alertService.alert(t('labels.error'), t('errors.parentContextRequired'));
      return false;
    }

    // Show confirmation if message provided
    if (confirmMessage) {
      return new Promise(resolve => {
        alertService.alert(
          operationName,
          itemName
            ? confirmMessage.replace('{name}', itemName)
            : confirmMessage,
          [
            {
              text: t('labels.cancel'),
              style: 'cancel',
              onPress: () => resolve(false),
            },
            {
              text: t('labels.delete'),
              style: 'destructive',
              onPress: async () => {
                const result = await executeRemoveImpl(
                  mutation,
                  itemId,
                  operationName,
                  onSuccess,
                  onError,
                );
                resolve(result);
              },
            },
          ],
        );
      });
    }

    return executeRemoveImpl(
      mutation,
      itemId,
      operationName,
      onSuccess,
      onError,
    );
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
      operationName = 'Operation',
    } = config;

    // Validate if validator provided
    if (validate) {
      const validation = validate(...args);
      if (typeof validation === 'string') {
        alertService.alert(t('labels.validationError'), validation);
        return false;
      }
      if (!validation) {
        alertService.alert(
          t('labels.validationError'),
          t('errors.invalidOperation'),
        );
        return false;
      }
    }

    const result = await executeMutation(
      () => operation(...args),
      error => {
        errorService.reportError(error, { operation: operationName });
        onError?.(error);
        handleMutationErrorAlert(error, { operation: operationName });
      },
    );

    if (!result) return false;

    if (surfaceCrudDataError(result.data, operationName)) {
      onError?.(new Error(operationName));
      return false;
    }

    if (result.data) {
      onSuccess?.(result.data);
      return result.data;
    }

    alertService.alert(t('labels.error'), t('errors.somethingWentWrong'));
    return false;
  };
}

/**
 * Hook that provides reusable CRUD operation patterns
 */
export function useCrudOperations() {
  const client = useApolloClient();

  return {
    createAddOperation: <TInput, TResult>(
      config: CreateOperationConfig<TInput, TResult>,
    ) => createAddOperationImpl(config),
    createUpdateOperation: <TInput, TResult>(
      config: UpdateOperationConfig<TInput, TResult>,
    ) => createUpdateOperationImpl(client, config),
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
