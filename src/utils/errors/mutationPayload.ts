import {
  GraphQLDomainError,
  GraphQLNetworkError,
} from '#/utils/errors/graphqlErrors';

/**
 * The two structural rules every errors-as-data reader depends on: which field
 * holds the payload, and whether it is the success member. Answered ONCE — a
 * classifier that diverges from the replay one dequeues a queued write as
 * success while its cache entry stays reverted. `mutationResultInvariants` guards.
 */

/**
 * Every mutation result union has exactly one non-`Error` member, so the suffix
 * decides success completely. The `Error` interface passes too, which is what
 * makes a bare `... on Error` arm classify correctly.
 */
export const isErrorTypename = (typename: string): boolean =>
  typename.endsWith('Error');

/**
 * Every mutation selects exactly one top-level field, so the payload is the only
 * entry. `null` means present but empty — how the offline queue reports a queued
 * write, so it must reach the caller and not be folded into "missing".
 * `undefined` means `data` was absent or had a field count other than one.
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
 * Which input a refusal was about, as a BARE field name (`field` can be a dotted
 * path). `message` is deliberately NOT returned — it is server-authored English
 * — so `field` ROUTES to localized copy in `alertRejectedMutation`. The cost:
 * one field can carry several rules, and one string has to cover them all.
 */
export function validationFieldName(data: unknown): string | null {
  const payload = extractMutationPayload(data);
  if (!payload || payload.__typename !== 'ValidationError') return null;
  const { field } = payload as { field?: string | null };
  if (!field) return null;
  const segments = field.split('.');
  return segments[segments.length - 1] || null;
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
