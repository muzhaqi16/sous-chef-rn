import { isTranslationKey, t } from '#/i18n';

/** The copy for a write refused because a record it names does not exist. */
export function getNotFoundMessage(resource?: string | null): string {
  if (!resource) {
    return t('errors.notFoundGeneric');
  }

  // The server names the resource; one the copy has no name for reads as itself.
  const resourceKey = `errors.resourceNames.${resource}`;
  const displayName = isTranslationKey(resourceKey)
    ? t(resourceKey)
    : resource.toLowerCase();

  return t('errors.notFoundResource', { resource: displayName });
}
