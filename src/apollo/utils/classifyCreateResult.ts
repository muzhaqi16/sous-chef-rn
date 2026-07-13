/**
 * Classify the outcome of a local-first create mutation.
 *
 * Every add site writes the new item to the cache before firing the mutation, so
 * the item is already visible. What differs is how to treat the *result*, and
 * the rule must be identical everywhere — this centralizes it so the branches
 * can't drift between call sites:
 *
 *  - `'created'`  — the server returned the success payload, OR a
 *                   `ConflictError(code: IDEMPOTENT_REPLAY)` — a client-PK create
 *                   replayed after it already committed (an online double-tap, or
 *                   a retry whose first response was lost). Both mean the row is
 *                   on the server: confirm and keep the optimistic item.
 *  - `'queued'`   — no data and no error: the create was queued while offline or
 *                   the API was unreachable. It replays later (keyed by the item's
 *                   id); keep the optimistic item and treat it as success.
 *  - `'rejected'` — a real error, or a non-success payload (e.g. `ConflictError` /
 *                   `ValidationError`): the server refused it. Revert the
 *                   optimistic item.
 *
 * @param result          the awaited mutation result (`{ data, error }`), or a
 *                        falsy value if the call threw before resolving
 * @param payloadKey      the mutation field name (e.g. `'createPantryItem'`)
 * @param successTypename the success payload `__typename`
 *                        (e.g. `'CreatePantryItemPayload'`)
 */
export type CreateOutcome = 'created' | 'queued' | 'rejected';

export function classifyCreateResult(
  result: { data?: unknown; error?: unknown } | null | undefined,
  payloadKey: string,
  successTypename: string,
): CreateOutcome {
  if (!result) return 'rejected';

  const data = result.data as Record<string, unknown> | null | undefined;
  const payload = data?.[payloadKey] as
    | { __typename?: string; code?: string }
    | null
    | undefined;

  if (payload?.__typename === successTypename) return 'created';
  // A client-PK create replayed after it already committed (an online double-tap,
  // or a retry whose first response was lost) resolves as
  // ConflictError(code: IDEMPOTENT_REPLAY) — the row is already on the server, so
  // it's a success, not a refusal. Match the CODE (mirrors the offline queue's
  // classifyReplayResult), never the message, and never a generic CONFLICT (a
  // real duplicate-name / business conflict → rejected below).
  if (
    payload?.__typename === 'ConflictError' &&
    payload.code === 'IDEMPOTENT_REPLAY'
  ) {
    return 'created';
  }
  // A surfaced error, or a non-success payload object (e.g. ConflictError /
  // ValidationError) → the server refused it.
  if (result.error || payload) return 'rejected';
  // No payload object (the field is null or absent) and no error → the create was
  // queued for later replay (the offline queue emits each field as null). Keep
  // the optimistic item.
  return 'queued';
}
