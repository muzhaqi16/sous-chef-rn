import { firstNonBlank } from '#/utils/firstNonBlank';
import {
  TopLevelErrorCode,
  type Mutation,
} from '#/graphql/generated/schemaTypes';

/**
 * The two structural rules every errors-as-data reader depends on: which field
 * holds the payload, and whether it is the success member. Answered ONCE — a
 * classifier that diverges from the replay one dequeues a queued write as
 * success while its cache entry stays reverted. `mutationResultInvariants` guards.
 */

/** The `__typename` of every member a mutation's result union can resolve as. */
type MutationPayloadTypename = Mutation[Exclude<
  keyof Mutation,
  '__typename'
>]['__typename'];

export type MutationErrorTypename = Extract<
  MutationPayloadTypename,
  `${string}Error`
>;

/**
 * Every mutation result union has exactly one non-`Error` member, so the suffix
 * decides success completely. The `Error` interface passes too, which is what
 * makes a bare `... on Error` arm classify correctly.
 */
export const isErrorTypename = (
  typename: string,
): typename is MutationErrorTypename => typename.endsWith('Error');

/**
 * Every mutation selects exactly one top-level field, so the payload is the only
 * entry. `null` means present but empty — how the offline queue reports a queued
 * write, so it must reach the caller and not be folded into "missing".
 * `undefined` means `data` was absent, had a field count other than one, or held
 * a non-object — every `Mutation` field returns a `*Result` union.
 */
export function extractMutationPayload(
  data: unknown,
): { __typename?: MutationPayloadTypename; code?: string } | null | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const fields = Object.entries(data).filter(([key]) => key !== '__typename');
  if (fields.length !== 1) return undefined;
  const value: unknown = fields[0]?.[1];
  if (value === null) return null;
  return typeof value === 'object' ? value : undefined;
}

type PayloadOf<TData> = TData extends object
  ? NonNullable<TData[Exclude<keyof TData, '__typename'>]>
  : never;

/** A mutation's success member: its payload union minus every `…Error` member. */
export type AppliedPayload<TData> = Exclude<
  PayloadOf<TData>,
  { __typename: `${string}Error` }
>;

/**
 * The row the write names is already gone. A removal settled with
 * `removal: true` reports that as applied, so its cache update must converge on
 * it too — otherwise the row stays on screen under a silent success.
 */
export function isAlreadyGone(data: unknown): boolean {
  const payload = extractMutationPayload(data);
  return (
    payload?.__typename === 'NotFoundError' ||
    payload?.code === TopLevelErrorCode.ResourceNotFound
  );
}

/** The success member of a mutation's result, or null for a refusal or a queued write. */
export function appliedPayload<TData>(
  data: TData | null | undefined,
): AppliedPayload<TData> | null {
  const payload = extractMutationPayload(data);
  if (!payload?.__typename || isErrorTypename(payload.__typename)) return null;
  return payload as AppliedPayload<TData>;
}

/**
 * Which input a refusal was about, as a BARE field name (`field` can be a dotted
 * path). `message` is deliberately NOT returned — it is server-authored English
 * — so `field` routes to localized copy. The cost: one field can carry several
 * rules, and one string has to cover them all.
 */
export function validationFieldName(data: unknown): string | null {
  const payload = extractMutationPayload(data);
  if (!payload || payload.__typename !== 'ValidationError') return null;
  const { field } = payload as { field?: string | null };
  if (!field) return null;
  const segments = field.split('.');
  return firstNonBlank(segments[segments.length - 1]) ?? null;
}
