import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { getTopLevelGraphQLError } from '#/utils/errors/graphqlErrors';
import { t } from '#/i18n';

export function isNotFoundErrorPayload(payload: {
  __typename: string;
}): boolean {
  return payload.__typename === 'NotFoundError';
}

export function getNotFoundMessage(resource?: string | null): string {
  if (!resource) {
    return t('errors.notFoundGeneric', {
      defaultValue:
        'The requested item could not be found. It may have been deleted.',
    });
  }

  const displayName =
    t(`errors.resourceNames.${resource}`, {
      defaultValue: resource.toLowerCase(),
    }) || resource.toLowerCase();

  return t('errors.notFoundResource', {
    resource: displayName,
    defaultValue:
      'The {{resource}} could not be found. It may have been deleted or moved.',
  });
}

/**
 * True when a by-id READ came back `RESOURCE_NOT_FOUND` (TOP-LEVEL channel; the
 * union member spells it `NOT_FOUND`). The pantry is the exception to the "a
 * query reports a miss as null data" note in `graphqlErrors.ts`. Gate on
 * `useIsCreateUnconfirmed` first: before a create is acknowledged it lies.
 */
export function isResourceNotFoundError(error: unknown): boolean {
  return (
    getTopLevelGraphQLError(error)?.code === TopLevelErrorCode.ResourceNotFound
  );
}
