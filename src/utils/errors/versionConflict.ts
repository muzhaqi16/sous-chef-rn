import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';

/**
 * The optimistic-lock failure, in both spellings the contract uses: the union
 * member's `code` and the thrown `extensions.code`. `CONFLICT` refuses on state
 * (already completed, already a member) and is deliberately not one of them.
 */
export const VERSION_CONFLICT_CODES: readonly string[] = [
  ErrorCode.VersionConflict,
  TopLevelErrorCode.ResourceVersionConflict,
];

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
  return error && typeof error === 'object' ? error : null;
}

const isVersionConflictCode = (code: unknown): boolean =>
  typeof code === 'string' && VERSION_CONFLICT_CODES.includes(code);

export function isVersionConflictError(error: unknown): boolean {
  const err = asConflictError(error);
  if (!err) {
    return false;
  }

  if (err.graphQLErrors) {
    return err.graphQLErrors.some(gqlErr =>
      isVersionConflictCode(gqlErr.extensions?.code),
    );
  }

  if (err.extensions) {
    return isVersionConflictCode(err.extensions.code);
  }

  return false;
}

/**
 * Always the generic "updated elsewhere" body: the API drops the
 * `currentVersion`/`expectedVersion` extensions when mapping to a union member,
 * so no typed detail exists on either channel.
 */
export function getVersionConflictMessage(): string {
  return t('errors.codes.versionConflict');
}
