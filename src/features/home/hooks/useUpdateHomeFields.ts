import { UpdateHomeDocument } from '#operations/home/home.generated';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { SettledFailure } from '#apollo/utils/settleMutation';
import { useTranslation } from '#i18n';

/** What a settings screen can change about a home through `updateHome`. */
export type HomeFieldUpdates = {
  name?: string;
  allowJoinCode?: boolean;
};

/**
 * Local-first and idempotent on a queued replay. Its own module because
 * `localFirstReplaySafety` reads a FILE for `localFirst` and holds every
 * operation that file names.
 */
export function useUpdateHomeFields(homeId: string) {
  const { t } = useTranslation();
  // The mutation returns updated scalar fields; Apollo merges by __typename + id.
  const updateHome = useLocalWrite(UpdateHomeDocument, {
    fallback: t('errors.updateHomeFailed'),
  });

  /**
   * `home` states the version the edit builds on. `fallback` is the copy a
   * failure shows when its code has none. The failure, if any: a form that
   * shows it on its field passes `onField`, and nothing else shows it.
   */
  const updateHomeFields = async (
    updates: HomeFieldUpdates,
    home: { version: number },
    fallback: string,
    { onField = false }: { onField?: boolean } = {},
  ): Promise<SettledFailure | undefined> => {
    const settled = await updateHome.sendFields(
      {
        entity: { __typename: 'Home', id: homeId },
        fields: updates,
        variables: {
          input: { id: homeId, ...updates, version: home.version },
        },
      },
      { settle: { fallback, ...(onField && { present: 'none' }) } },
    );
    return settled.failure;
  };

  return { updateHomeFields };
}
