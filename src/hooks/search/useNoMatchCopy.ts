import { useTranslation } from '#/i18n';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';

interface NoMatchCopy {
  /** The search ran over only what the device holds, so more may exist. */
  heldOnly: boolean;
  title: string;
  description?: string;
}

/**
 * What a search that matched nothing says. Offline it covered only what the
 * device holds, so "no results" would claim nothing exists; `holdsEverything`
 * says the device has the whole set, where no match is the answer.
 */
export function useNoMatchCopy(
  query: string,
  holdsEverything = false,
): NoMatchCopy {
  const { t } = useTranslation();
  const isOffline = useIsApiUnavailable();

  if (isOffline && !holdsEverything) {
    return {
      heldOnly: true,
      title: t('empty.noHeldMatchFor', { query }),
      description: t('empty.widerSearchNeedsConnection'),
    };
  }
  return { heldOnly: false, title: t('empty.noResultsFor', { query }) };
}
