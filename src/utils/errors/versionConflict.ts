import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n/t';

/**
 * Codes that mark an optimistic-concurrency conflict, whether the error arrives
 * as a thrown/top-level GraphQL error (`extensions.code`) or a resolved
 * errors-as-data union member (the member's own `code` field). The API emits
 * `VERSION_CONFLICT` for optimistic-lock failures and `CONFLICT` for other
 * uniqueness/state conflicts — both get the "updated elsewhere" treatment.
 */
const CONFLICT_CODES = new Set<string>([
  ErrorCode.Conflict,
  ErrorCode.VersionConflict,
]);

/**
 * Minimal shape of a GraphQL error carrying conflict metadata in `extensions`.
 */
interface GraphQLErrorLike {
  extensions?: Record<string, unknown>;
}

/**
 * Error shapes accepted by the version-conflict helpers: either an Apollo-style
 * error wrapping `graphQLErrors`, or a single GraphQL error with `extensions`.
 */
interface ConflictErrorLike extends GraphQLErrorLike {
  graphQLErrors?: GraphQLErrorLike[];
}

function asConflictError(error: unknown): ConflictErrorLike | null {
  return error && typeof error === 'object'
    ? (error as ConflictErrorLike)
    : null;
}

/**
 * Check if an error is a CONFLICT error from the API (Apollo error level)
 *
 * @param error - Error object that may contain GraphQL errors
 * @returns True if the error is a version conflict
 */
export function isVersionConflictError(error: unknown): boolean {
  const err = asConflictError(error);
  if (!err) {
    return false;
  }

  if (err.graphQLErrors) {
    return err.graphQLErrors.some(gqlErr => {
      const code = gqlErr.extensions?.code;
      return typeof code === 'string' && CONFLICT_CODES.has(code);
    });
  }

  if (err.extensions) {
    const code = err.extensions.code;
    return typeof code === 'string' && CONFLICT_CODES.has(code);
  }

  return false;
}

/**
 * Check if an errors-as-data member's `code` marks a version conflict. The
 * union member carries only `code` + `message` — pass the member's code
 * directly (there is no `success` field on current payloads).
 */
export function isVersionConflictPayload(code: string): boolean {
  return CONFLICT_CODES.has(code);
}

/**
 * The `*Error` union member resolved inside a mutation's `data` (errors-as-data)
 * as opposed to a thrown GraphQL error. Under `errorPolicy: 'all'` an error
 * resolves as a truthy `data` member and never throws; a single-mutation payload
 * holds at most one such member. Walks the payload's field values and returns
 * the first whose `__typename` ends in `Error`, exposing its `typename`, `code`,
 * and `message` (each `null` when absent), or `null` when none is present.
 */
export function findFirstErrorMember(
  data: unknown,
): { typename: string; code: string | null; message: string | null } | null {
  if (!data || typeof data !== 'object') return null;
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const typename = (value as { __typename?: unknown }).__typename;
    if (typeof typename !== 'string' || !typename.endsWith('Error')) continue;
    const code = (value as { code?: unknown }).code;
    const message = (value as { message?: unknown }).message;
    return {
      typename,
      code: typeof code === 'string' ? code : null,
      message: typeof message === 'string' ? message : null,
    };
  }
  return null;
}

/**
 * Detect a `ConflictError` union member resolved inside a mutation's `data`,
 * so the update path can reach the version-conflict refresh UX instead of a
 * generic alert. Returns the member's message (or `null`) when the resolved
 * error member is a conflict, otherwise `null`.
 */
export function findConflictDataMember(
  data: unknown,
): { message: string | null } | null {
  const member = findFirstErrorMember(data);
  if (!member) return null;
  const isConflict =
    member.typename === 'ConflictError' ||
    (member.code !== null && CONFLICT_CODES.has(member.code));
  return isConflict ? { message: member.message } : null;
}

/**
 * Get the user-friendly message for a version conflict.
 *
 * The errors-as-data contract carries conflict context only in the member's
 * `message` string — the API drops `currentVersion`/`expectedVersion`
 * extensions when mapping to the union member, so there are no typed detail
 * fields to read on either channel. Always the generic "updated elsewhere"
 * body; callers that have the member's message show that instead.
 */
export function getVersionConflictMessage(): string {
  return t('errors.entityUpdatedBody');
}

/**
 * Handle version conflict errors with user-friendly alerts
 *
 * @param error - Apollo error to check
 * @param onRefresh - Optional callback to refresh data
 * @returns True if error was a version conflict and was handled
 *
 * @example
 * ```typescript
 * try {
 *   await updateQuantity({ id, quantity, version });
 * } catch (error) {
 *   if (handleVersionConflict(error, () => refetch())) {
 *     return; // Error was handled
 *   }
 *   // Handle other errors
 * }
 * ```
 */
export function handleVersionConflict(error: unknown): boolean {
  if (!isVersionConflictError(error)) {
    return false;
  }

  console.warn('⚠️ Version conflict detected:', {
    message: getVersionConflictMessage(),
    error,
  });

  // Return true to indicate the error was a version conflict
  // The caller should show an appropriate UI alert
  return true;
}
