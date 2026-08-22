import {
  GraphQLDomainError,
  GraphQLNetworkError,
} from '#/utils/errors/graphqlErrors';

/**
 * The two structural rules every errors-as-data reader in this app depends on.
 *
 * Under `errorPolicy: 'all'` a server refusal resolves 200 as a union member in
 * `data` rather than throwing, so each reader has to answer the same pair of
 * questions: which field holds the payload, and is that payload the success
 * member. They were answered in four places with four copies of the rule; a
 * divergence between the foreground classifier and the replay classifier would
 * show up as a queued write dequeued as success while its optimistic cache
 * entry stays reverted — silent, and only in production.
 *
 * `__tests__/graphql/mutationResultInvariants.test.ts` asserts both rules hold
 * against the generated SDL and every authored operation, and imports the
 * helpers below so it guards the code rather than a restatement of it.
 */

/**
 * True when a union member is an error arm.
 *
 * Every mutation result union in the schema has exactly one non-`Error` member,
 * so the suffix decides success completely — no per-call-site success typename
 * to keep in sync. The `Error` interface itself passes too, which is what makes
 * a bare `... on Error` arm classify correctly.
 */
export const isErrorTypename = (typename: string): boolean =>
  typename.endsWith('Error');

/**
 * The mutation's single payload field, read out of `data`.
 *
 * Every mutation operation selects exactly one top-level field, so the payload
 * is the only entry. Returns `null` when that field is present but empty —
 * which is how the offline queue reports a queued write, so the null case must
 * reach the caller rather than being folded into "missing" here.
 *
 * Returns `undefined` when `data` is absent or carries anything other than one
 * field, since there is then no way to tell which entry holds the outcome.
 * Apollo does not add `__typename` to a root mutation selection set, but it is
 * filtered anyway so a hand-built fixture can't trip the count.
 */
export function extractMutationPayload(
  data: unknown,
): { __typename?: string; code?: string } | null | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const fields = Object.entries(data).filter(([key]) => key !== '__typename');
  if (fields.length !== 1) return undefined;
  return fields[0][1];
}

/**
 * The sentence a refused union payload is worth showing the user, or `null`.
 *
 * A field-specific `ValidationError` carries its rule's own wording in
 * `message` — "Cannot change tracking unit while batches exist. Deplete all
 * batches first." — and names the input it was about in `field`
 * (sous-chef-api `docs/api/breaking-changes.md`, 2026-08-22; before that the
 * message was the fixed "Validation failed for field: …" and the sentence was
 * stranded in an extension the union member does not expose). A mutation that
 * takes several sub-inputs in one call — `updatePantryItem` carries `brand`,
 * `netWeight`, `storage` and `unit` — has nothing else to say about WHICH one
 * was refused, so when `field` is set the server's sentence beats the caller's
 * generic "failed to update". Without a `field` the refusal is unattributed and
 * the caller's own copy is the honest one. `field` routes; `message` displays.
 */
export function fieldValidationMessage(data: unknown): string | null {
  const payload = extractMutationPayload(data);
  if (!payload || payload.__typename !== 'ValidationError') return null;
  const { field, message } = payload as {
    field?: string | null;
    message?: string | null;
  };
  return field && message ? message : null;
}

/** Narrows a GraphQL union-type mutation payload to the success variant.
 *  Throws GraphQLNetworkError when payload is null/undefined (transport failure),
 *  or GraphQLDomainError when the server returns an error union member. */
export function unwrapPayload<
  TUnion extends { __typename: string },
  TName extends TUnion['__typename'],
>(
  payload: TUnion | null | undefined,
  successTypename: TName,
  fallbackMessage: string,
): Extract<TUnion, { __typename: TName }> {
  if (payload == null) {
    throw new GraphQLNetworkError(fallbackMessage);
  }
  if (payload.__typename === successTypename) {
    return payload as Extract<TUnion, { __typename: TName }>;
  }
  const { __typename, code, message, ...extra } = payload as Record<
    string,
    unknown
  > & { __typename: string };
  throw new GraphQLDomainError({
    __typename,
    code: String(code ?? 'UNKNOWN'),
    message: String(message || fallbackMessage),
    ...extra,
  });
}

/** Type guard for union-type mutation payloads — returns true and narrows type
 *  if the payload matches the success typename. Unlike `unwrapPayload`, this
 *  does not throw — use it in hooks with `update`/`optimisticResponse` where
 *  the error handling happens via `onError` or `handleMutationError`. */
export function isSuccessPayload<
  TUnion extends { __typename: string },
  TName extends TUnion['__typename'],
>(
  payload: TUnion | null | undefined,
  successTypename: TName,
): payload is Extract<TUnion, { __typename: TName }> {
  return payload != null && payload.__typename === successTypename;
}
