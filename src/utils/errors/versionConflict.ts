import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { isErrorTypename } from './mutationPayload';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';

/**
 * The optimistic-lock failure, in both spellings the contract uses: the union
 * member's `code` and the thrown `extensions.code`. Exported because the
 * offline queue needs exactly this subset — a write may be re-sent without its
 * captured version only when the version is what the server objected to.
 */
export const VERSION_CONFLICT_CODES: readonly string[] = [
  ErrorCode.VersionConflict,
  TopLevelErrorCode.ResourceVersionConflict,
];

// Conflict codes on BOTH channels — a top-level `extensions.code` and a resolved
// union member's own `code`. `CONFLICT` covers uniqueness/state, which is not
// re-sendable; it is here because the foreground shows "updated elsewhere" for
// both, and deliberately absent from the queue's narrower subset above.
const CONFLICT_CODES = new Set<string>([
  ErrorCode.Conflict,
  ...VERSION_CONFLICT_CODES,
]);

/**
 * Minimal shape of a GraphQL error carrying conflict metadata in `extensions`.
 */
interface GraphQLErrorLike {
  extensions?: Record<string, unknown>;
}

/** Either an Apollo error wrapping `graphQLErrors`, or a single GraphQL error. */
interface ConflictErrorLike extends GraphQLErrorLike {
  graphQLErrors?: GraphQLErrorLike[];
}

function asConflictError(error: unknown): ConflictErrorLike | null {
  return error && typeof error === 'object'
    ? (error as ConflictErrorLike)
    : null;
}

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

/** For an errors-as-data member, which carries only `code` + `message`. */
export function isVersionConflictPayload(code: string): boolean {
  return CONFLICT_CODES.has(code);
}

/**
 * The `*Error` union member resolved inside `data` — under `errorPolicy: 'all'`
 * a refusal resolves as a truthy member and never throws, and a single-mutation
 * payload holds at most one.
 */
export function findFirstErrorMember(
  data: unknown,
): { typename: string; code: string | null; message: string | null } | null {
  if (!data || typeof data !== 'object') return null;
  for (const value of Object.values(data as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const typename = (value as { __typename?: unknown }).__typename;
    if (typeof typename !== 'string' || !isErrorTypename(typename)) continue;
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
 * Routes a resolved `ConflictError` member to the version-conflict refresh UX
 * rather than a generic alert. A predicate, not an accessor: the member's own
 * `message` is unlocalizable English and is never a candidate for display.
 */
export function isConflictDataMember(data: unknown): boolean {
  const member = findFirstErrorMember(data);
  if (!member) return false;
  return (
    member.typename === 'ConflictError' ||
    (member.code !== null && CONFLICT_CODES.has(member.code))
  );
}

/**
 * Always the generic "updated elsewhere" body: the API drops the
 * `currentVersion`/`expectedVersion` extensions when mapping to a union member,
 * so no typed detail exists on either channel.
 */
export function getVersionConflictMessage(): string {
  return t('errors.codes.versionConflict');
}

/** @returns true when the error was a version conflict and was handled. */
export function handleVersionConflict(error: unknown): boolean {
  if (!isVersionConflictError(error)) {
    return false;
  }

  logger.warn('⚠️ Version conflict detected:', {
    message: getVersionConflictMessage(),
    error,
  });

  // Return true to indicate the error was a version conflict
  // The caller should show an appropriate UI alert
  return true;
}
