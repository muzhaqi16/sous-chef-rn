import { TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { getTopLevelGraphQLError } from './graphqlErrors';
import { getI18n } from '#/i18n/config';

export function isNotFoundErrorPayload(payload: {
  __typename: string;
}): boolean {
  return payload.__typename === 'NotFoundError';
}

export function getNotFoundMessage(resource?: string | null): string {
  const i18n = getI18n();

  if (!resource) {
    return i18n.t('errors.notFoundGeneric', {
      defaultValue:
        'The requested item could not be found. It may have been deleted.',
    });
  }

  const displayName =
    i18n.t(`errors.resourceNames.${resource}`, {
      defaultValue: resource.toLowerCase(),
    }) || resource.toLowerCase();

  return i18n.t('errors.notFoundResource', {
    resource: displayName,
    defaultValue:
      'The {{resource}} could not be found. It may have been deleted or moved.',
  });
}

/**
 * True when a by-id READ came back `RESOURCE_NOT_FOUND` — the row is gone.
 *
 * The note in `graphqlErrors.ts` says a by-id QUERY reports a miss as null
 * data and that `RESOURCE_NOT_FOUND` is the mutation-only spelling. That does
 * not hold for the pantry: `PantryItemQueryService.getItemById` throws
 * `NotFoundError`, so `GetPantryItem` delivers the miss as a field error on
 * `["pantryItem"]`. Confirmed against the API resolver and production logs.
 *
 * The code lives on the TOP-LEVEL channel (`TopLevelErrorCode`), not the
 * union-member `ErrorCode` — a thrown `NotFoundError` escaping a resolver is
 * `RESOURCE_NOT_FOUND`, while the union member spells it `NOT_FOUND`.
 *
 * Callers must not treat this as authoritative for a row whose create the
 * server has not acknowledged yet — there the same code only means "not told
 * about it yet". Gate on `useIsCreateUnconfirmed` first.
 */
export function isResourceNotFoundError(error: unknown): boolean {
  return (
    getTopLevelGraphQLError(error)?.code === TopLevelErrorCode.ResourceNotFound
  );
}
