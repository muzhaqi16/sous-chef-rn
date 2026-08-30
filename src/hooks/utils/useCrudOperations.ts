/**
 * Shared add/update/remove operation builders for the feature management hooks.
 */

import { alertService } from '#/services/alertService';
import { useApolloClient } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import { DocumentNode } from 'graphql';
import { errorService } from '#/services/errorService';
import {
  handleVersionConflictAlert,
  handleMutationErrorAlert,
  alertVersionConflict,
} from '#/utils/errorHandlers';
import {
  findConflictDataMember,
  findFirstErrorMember,
} from '#/utils/errors/versionConflict';
import { validationFieldName } from '#/utils/errors/mutationPayload';
import { t } from '#/i18n';

/**
 * Alerts + reports an errors-as-data refusal, which under `errorPolicy:'all'`
 * would otherwise read as success. Copy mirrors `alertRejectedMutation`: a
 * `field` resolves `errors.field.<field>`, else `code` via `errors.codes.*`.
 * The server's `message` is English by construction — telemetry only.
 */
function surfaceCrudDataError(data: unknown, operationName: string): boolean {
  const member = findFirstErrorMember(data);
  if (!member) return false;
  const codeMessage = member.code
    ? errorService.getUserFriendlyMessage(member.code)
    : t('errors.codes.genericRetry');
  const field = validationFieldName(data);
  const message = field
    ? t(`errors.field.${field}`, { defaultValue: codeMessage })
    : codeMessage;
  alertService.alert(t('labels.error'), message);
  errorService.reportError(
    new Error(
      `${operationName}: ${member.message || member.code || member.typename}`,
    ),
    { operation: operationName },
  );
  return true;
}

/**
 * Resolved value these CRUD helpers read off an Apollo mutate call — `data`
 * plus, under `errorPolicy: 'all'`, an `errors` array.
 */
type MutateResultLike<TResult> = {
  data?: TResult | null;
  errors?: readonly {
    message: string;
    extensions?: Record<string, unknown>;
  }[];
};

/**
 * Minimal mutate options. The config interfaces declare `mutation` as a METHOD
 * so the parameter is checked bivariantly — that is what keeps a strongly-typed
 * `useMutation()[0]` assignable while these helpers call it with a
 * dynamically-built `{ variables }` record.
 */
type MutateOptions = { variables?: Record<string, unknown> };

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
  /**
   * Localized heading for the confirmation dialog. Required alongside
   * `confirmMessage`: `operationName` is a telemetry label, English by
   * construction, and must never reach a dialog.
   */
  confirmTitle?: string;
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

    let result;
    try {
      result = await mutation({ variables });
    } catch (error) {
      errorService.reportError(error, { operation: operationName });
      onError?.(error);
      handleMutationErrorAlert(error, { operation: operationName });
    }

    if (!result) return false;

    // Handle GraphQL errors returned with errorPolicy: 'all'
    // Check errors FIRST because result.data may be { mutationName: null } even on error
    if (result.errors && result.errors.length > 0) {
      // A top-level GraphQL error carries `extensions.code`; its `message` is
      // server-authored English and is never displayed — map the code to
      // localized copy (an absent or unmapped code gets a generic line).
      const code = result.errors[0].extensions?.code;
      alertService.alert(
        t('labels.error'),
        typeof code === 'string'
          ? errorService.getUserFriendlyMessage(code)
          : t('errors.codes.genericRetry'),
      );
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

    alertService.alert(t('labels.error'), t('errors.codes.genericRetry'));
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

    let result;
    try {
      result = await mutation({
        variables: {
          input: { id: itemId, ...transformedInput },
        },
      });
    } catch (error) {
      // Handle version conflicts. No itemName: the alert resolves the
      // localized errors.entityItem default for the generic CRUD path.
      if (
        handleVersionConflictAlert(error, {
          onRefresh: onVersionConflict,
        })
      ) {
        // A version conflict is surfaced by the alert above and handled by its
        // refresh callback; report it as a failed update, not as a success.
        return false;
      }

      errorService.reportError(error, { operation: operationName });
      onError?.(error);
      handleMutationErrorAlert(error, { operation: operationName });
    }

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

    alertService.alert(t('labels.error'), t('errors.codes.genericRetry'));
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
  let result;
  try {
    result = await mutation({ variables: { input: { id: itemId } } });
  } catch (error) {
    errorService.reportError(error, { operation: operationName });
    onError?.(error);
    handleMutationErrorAlert(error, { operation: operationName });
  }

  if (!result) return false;

  if (surfaceCrudDataError(result.data, operationName)) {
    onError?.(new Error(operationName));
    return false;
  }

  if (result.data) {
    onSuccess?.(result.data);
    return result.data;
  }

  alertService.alert(t('labels.error'), t('errors.codes.genericRetry'));
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
      confirmTitle,
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
        alertService.alert(confirmTitle ?? operationName, confirmMessage, [
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
        ]);
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

    let result;
    try {
      result = await operation(...args);
    } catch (error) {
      errorService.reportError(error, { operation: operationName });
      onError?.(error);
      handleMutationErrorAlert(error, { operation: operationName });
    }

    if (!result) return false;

    if (surfaceCrudDataError(result.data, operationName)) {
      onError?.(new Error(operationName));
      return false;
    }

    if (result.data) {
      onSuccess?.(result.data);
      return result.data;
    }

    alertService.alert(t('labels.error'), t('errors.codes.genericRetry'));
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
