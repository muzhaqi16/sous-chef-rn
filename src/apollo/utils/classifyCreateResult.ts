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
 * Takes the result and nothing else. Both facts it needs are derivable, so
 * naming them at the call site only creates strings that can go stale:
 *
 *  - **Which field holds the payload** — every mutation operation in this app
 *    selects exactly one top-level field, so it's the single non-`__typename`
 *    entry in `data`. {@link QueueManager.executeMutation} reads the replay
 *    payload the same way.
 *  - **Whether that payload is the success member** — its `__typename` doesn't
 *    end in `Error`. All 246 `*Result` mutation unions in the schema have
 *    exactly one non-`Error` member, so the suffix decides it completely. (The
 *    only multi-payload unions are the `*EventNode` subscription unions, which
 *    never reach here.) {@link classifyReplayResult} applies the same rule on
 *    the replay side, and the two must agree.
 *
 * An earlier signature took the field name and the expected payload typename as
 * strings. Neither was checkable against the schema, and a stale one failed
 * silently in the worst direction: every create classified as `'rejected'`,
 * reverting its optimistic write forever.
 *
 * @param result the awaited mutation result (`{ data, error }`), or a falsy
 *               value if the call threw before resolving
 */
import { ErrorCode } from '#/graphql/generated/schemaTypes';

export type CreateOutcome = 'created' | 'queued' | 'rejected';

/**
 * The mutation's single payload field. `null` when the field is present but
 * empty — which is how the offline queue reports a queued write, so the null
 * case must survive to the caller rather than being filtered out here.
 */
function extractPayload(
  data: unknown,
): { __typename?: string; code?: string } | null | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const fields = Object.entries(data).filter(([key]) => key !== '__typename');
  if (fields.length !== 1) return undefined;
  return fields[0][1];
}

export function classifyCreateResult(
  result: { data?: unknown; error?: unknown } | null | undefined | false,
): CreateOutcome {
  if (!result) return 'rejected';

  const payload = extractPayload(result.data);

  if (payload?.__typename) {
    if (!payload.__typename.endsWith('Error')) return 'created';
    // A client-PK create replayed after it already committed (an online
    // double-tap, or a retry whose first response was lost) resolves as
    // ConflictError(code: IDEMPOTENT_REPLAY) — the row is already on the server,
    // so it's a success, not a refusal. Match the CODE (mirrors the offline
    // queue's classifyReplayResult), never the message, and never a generic
    // CONFLICT (a real duplicate-name / business conflict → rejected below).
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
  // No payload object (the field is null or absent) and no error → the create was
  // queued for later replay (the offline queue emits each field as null). Keep
  // the optimistic item.
  return 'queued';
}
