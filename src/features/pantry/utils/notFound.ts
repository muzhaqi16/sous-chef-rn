import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';

/**
 * True when a by-id READ answered `RESOURCE_NOT_FOUND` (top-level channel; the
 * union spells it `NOT_FOUND`): an older API's miss, kept beside the null
 * check. Gate on `useIsCreateUnconfirmed` first: before the ack it lies.
 */
export function isResourceNotFoundError(error: unknown): boolean {
  return (
    getTopLevelGraphQLError(error)?.code === TopLevelErrorCode.ResourceNotFound
  );
}
