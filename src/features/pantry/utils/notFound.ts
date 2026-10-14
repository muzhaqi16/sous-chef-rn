import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';

/**
 * True when a by-id READ came back `RESOURCE_NOT_FOUND` (TOP-LEVEL channel; the
 * union member spells it `NOT_FOUND`). A pantry read reports a miss as null
 * data, like every by-id query; this is the answer of an API before that, kept
 * beside the null check. Gate on `useIsCreateUnconfirmed` first: before a
 * create is acknowledged it lies.
 */
export function isResourceNotFoundError(error: unknown): boolean {
  return (
    getTopLevelGraphQLError(error)?.code === TopLevelErrorCode.ResourceNotFound
  );
}
