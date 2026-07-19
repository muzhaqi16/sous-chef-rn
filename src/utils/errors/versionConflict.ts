import { t } from '#/i18n/t';
import { getI18n } from '#/i18n/config';

/**
 * Version Conflict Error Details
 */
export interface VersionConflictDetails {
  resourceType: string;
  currentVersion: number;
  expectedVersion: number;
}

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
    return err.graphQLErrors.some(
      gqlErr => gqlErr.extensions?.code === 'CONFLICT',
    );
  }

  if (err.extensions) {
    return err.extensions.code === 'CONFLICT';
  }

  return false;
}

/**
 * Check if a mutation payload indicates a CONFLICT error.
 * Use this to detect version conflicts returned as payload fields (success: false, code: 'CONFLICT')
 * rather than thrown GraphQL errors.
 */
export function isVersionConflictPayload(payload: {
  success: boolean;
  code: string;
}): boolean {
  return !payload.success && payload.code === 'CONFLICT';
}

/**
 * Codes that mark an optimistic-concurrency conflict, whether the error arrives
 * as a thrown GraphQL error (`extensions.code`) or a resolved errors-as-data
 * union member (the member's own `code` field).
 */
const CONFLICT_CODES = new Set(['CONFLICT', 'VERSION_CONFLICT']);

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
 * Extract version conflict details from an error
 *
 * @param error - Error containing CONFLICT
 * @returns Version conflict details or null if not a version conflict
 */
export function getVersionConflictDetails(
  error: unknown,
): VersionConflictDetails | null {
  const err = asConflictError(error);
  if (!err) {
    return null;
  }

  let versionError: GraphQLErrorLike | undefined;

  if (err.graphQLErrors) {
    versionError = err.graphQLErrors.find(
      gqlErr => gqlErr.extensions?.code === 'CONFLICT',
    );
  } else if (err.extensions) {
    versionError = err;
  }

  if (!versionError || !versionError.extensions) {
    return null;
  }

  const { resourceType, currentVersion, expectedVersion } =
    versionError.extensions;

  if (
    typeof resourceType === 'string' &&
    typeof currentVersion === 'number' &&
    typeof expectedVersion === 'number'
  ) {
    return {
      resourceType,
      currentVersion,
      expectedVersion,
    };
  }

  return null;
}

/**
 * Get a user-friendly message for a version conflict error
 *
 * @param error - Error containing CONFLICT
 * @returns User-friendly error message
 */
export function getVersionConflictMessage(error: unknown): string {
  const details = getVersionConflictDetails(error);

  if (!details) {
    return t('errors.entityUpdatedBody');
  }

  return getI18n().t('errors.entityUpdatedBodyTyped', {
    entity: details.resourceType.toLowerCase(),
  });
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

  const message = getVersionConflictMessage(error);
  const details = getVersionConflictDetails(error);

  console.warn('⚠️ Version conflict detected:', {
    message,
    details,
    error,
  });

  // Return true to indicate the error was a version conflict
  // The caller should show an appropriate UI alert
  return true;
}
