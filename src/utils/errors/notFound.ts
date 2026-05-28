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
