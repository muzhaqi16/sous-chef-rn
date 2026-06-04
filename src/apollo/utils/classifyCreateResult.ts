/**
 * Classify the outcome of a local-first create mutation.
 *
 * Every add site writes the new item to the cache before firing the mutation, so
 * the item is already visible. What differs is how to treat the *result*, and
 * the rule must be identical everywhere — this centralizes it so the branches
 * can't drift between call sites:
 *
 *  - `'created'`  — the server returned the success payload. Confirm and reconcile.
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
  const payload = data?.[payloadKey] as { __typename?: string } | undefined;

  if (payload?.__typename === successTypename) return 'created';
  // Data present but not the success payload, or a surfaced error → refused.
  if (result.error || data) return 'rejected';
  // Neither data nor error → the request was queued for later replay.
  return 'queued';
}
