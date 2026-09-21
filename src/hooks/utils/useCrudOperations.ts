/**
 * The shared remove operation builder for the feature management hooks.
 * Every write settles through `settleMutation`, so a failure is classified,
 * reported and shown exactly once whichever form it arrives in.
 */

import { alertService } from '#/services/alertService';
import type { DocumentNode } from 'graphql';
import {
  settleMutation,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { t } from '#/i18n';

/** What the builder reads off a mutate call: `data`, and a resolved `error`. */
type MutateResultLike<TResult> = {
  data?: TResult | null;
  error?: unknown;
};

/**
 * Minimal mutate options. The config interface declares `mutation` as a METHOD
 * so the parameter is checked bivariantly — that is what keeps a strongly-typed
 * `useMutation()[0]` assignable while the builder calls it with a
 * dynamically-built `{ variables }` record.
 */
type MutateOptions = { variables?: Record<string, unknown> };

/** Settling config. */
interface SettleConfig {
  /** The generated document the mutation sends; it labels the failure report. */
  document: DocumentNode;
  /** Localized copy for a failure nothing more specific describes. */
  fallback?: string;
  /** Undoes a local change. Runs once, on any failure. */
  onFailed?: () => void;
}

export interface RemoveOperationConfig<TResult> extends SettleConfig {
  mutation(options: MutateOptions): Promise<MutateResultLike<TResult>>;
  parentId?: string | null | (() => string | null | undefined);
  itemId: string;
  confirmMessage?: string;
  /** Localized heading for the confirmation dialog; `labels.delete` when absent. */
  confirmTitle?: string;
  onSuccess?: (data: TResult) => void;
}

// --- Module-level factory implementations (outside hook body for React Compiler) ---

function settleOptions(
  config: SettleConfig,
  extra: Partial<SettleOptions> = {},
): SettleOptions {
  return {
    document: config.document,
    fallback: config.fallback ?? t('errors.codes.genericRetry'),
    onFailed: config.onFailed,
    ...extra,
  };
}

/** A missing required parent context, alerted; `true` when the call may proceed. */
function hasParentContext(
  parentId: string | null | (() => string | null | undefined) | undefined,
): boolean {
  const resolved = typeof parentId === 'function' ? parentId() : parentId;
  if (resolved === null || resolved === '') {
    alertService.alert(t('labels.error'), t('errors.parentContextRequired'));
    return false;
  }
  return true;
}

async function settleAndDeliver<TResult>(
  run: () => Promise<MutateResultLike<TResult>>,
  options: SettleOptions,
  onSuccess: ((data: TResult) => void) | undefined,
): Promise<TResult | false> {
  const settled = await settleMutation(run, options);
  if (settled.status === 'failed' || !settled.data) return false;
  // `settled.data` holds whichever union member came back, so a converged
  // removal carries an error member — not something `onSuccess` may read.
  if (appliedPayload(settled.data)) onSuccess?.(settled.data);
  return settled.data;
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
    } = config;

    if (!hasParentContext(parentId)) return false;

    // A row that is already gone is the outcome a removal asked for — which
    // obliges each caller's `update` to take it out of the cache on that
    // refusal too, or the row stays on screen under a silent success.
    const execute = () =>
      settleAndDeliver(
        () => mutation({ variables: { input: { id: itemId } } }),
        settleOptions(config, { removal: true }),
        onSuccess,
      );

    if (!confirmMessage) return execute();

    return new Promise(resolve => {
      alertService.alert(confirmTitle ?? t('labels.delete'), confirmMessage, [
        {
          text: t('labels.cancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: t('labels.delete'),
          style: 'destructive',
          onPress: () => {
            void execute().then(resolve);
          },
        },
      ]);
    });
  };
}

/** Builds remove operations that confirm first when given a `confirmMessage`. */
export function useCrudOperations() {
  return {
    createRemoveOperation: <TResult>(config: RemoveOperationConfig<TResult>) =>
      createRemoveOperationImpl(config),
  };
}
