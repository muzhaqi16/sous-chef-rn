import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { isErrorTypename } from './mutationPayload';
import { t } from '#/i18n';
import { logger } from '#/utils/environment';

// Conflict codes on BOTH channels — a top-level `extensions.code` and a resolved
// union member's own `code`. `VERSION_CONFLICT` is the optimistic-lock failure,
// `CONFLICT` covers uniqueness/state; both get "updated elsewhere".
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
 * rather than a generic alert.
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
 * Always the generic "updated elsewhere" body: the API drops the
 * `currentVersion`/`expectedVersion` extensions when mapping to a union member,
 * so no typed detail exists on either channel. A caller holding the member's
 * own `message` shows that instead.
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
