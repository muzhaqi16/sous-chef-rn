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
