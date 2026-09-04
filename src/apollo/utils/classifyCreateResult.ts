/**
 * Classify a local-first create result: `'created'` (success payload, or a
 * `ConflictError(IDEMPOTENT_REPLAY)` — the row is already on the server),
 * `'queued'` (no data and no error, replays later — keep the optimistic item), or
 * `'rejected'` (error or non-success payload — revert the optimistic write).
 */
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  extractMutationPayload,
  isErrorTypename,
} from '#/utils/errors/mutationPayload';

export type CreateOutcome = 'created' | 'queued' | 'rejected';

export function classifyCreateResult(
  result: { data?: unknown; error?: unknown } | null | undefined | false,
): CreateOutcome {
  if (!result) return 'rejected';

  const payload = extractMutationPayload(result.data);

  if (payload?.__typename) {
    if (!isErrorTypename(payload.__typename)) return 'created';
    // IDEMPOTENT_REPLAY means the row already committed server-side — a success.
    // Match the CODE (as the queue's classifyReplayResult does), never the message
    // and never a generic CONFLICT, which is a real refusal.
    if (
      payload.__typename === 'ConflictError' &&
      payload.code === ErrorCode.IdempotentReplay
    ) {
      return 'created';
    }
    return 'rejected';
  }

  // A surfaced error with no payload object → the server refused it.
  if (result.error) return 'rejected';
  // No payload and no error → queued for later replay (the queue emits each field
  // as null). Keep the optimistic item.
  return 'queued';
}

/**
 * The same classification for a DELETE, where "never held" is the outcome asked
 * for, not a refusal: `NotFoundError` and a `converged: true` payload both mean
 * the row is gone. Treating the first as a refusal reverts the optimistic
 * removal and leaves a phantom no refresh can clear.
 */
export function classifyDeleteResult(
  result: { data?: unknown; error?: unknown } | null | undefined | false,
): CreateOutcome {
  const outcome = classifyCreateResult(result);
  if (outcome !== 'rejected') return outcome;

  const payload = extractMutationPayload(result ? result.data : undefined);
  return payload?.__typename === 'NotFoundError' ? 'created' : 'rejected';
}
