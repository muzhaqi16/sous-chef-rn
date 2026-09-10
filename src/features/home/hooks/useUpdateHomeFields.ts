import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateHomeDocument } from '#operations/home/home.generated';
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { localizedErrorMessage } from '#/services/errorService';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';

/** What a settings screen can change about a home through `updateHome`. */
export interface HomeFieldUpdates {
  name?: string;
  allowJoinCode?: boolean;
}

/**
 * Local-first: an absolute field set keyed by the home id, written to the cache
 * before firing and idempotent on a queued replay. Its own module because
 * `localFirstReplaySafety` reads a FILE for `localFirst` and then holds every
 * operation that file names.
 */
export function useUpdateHomeFields(homeId: string) {
  const client = useApolloClient();
  const [updateHomeMutation, { loading: updating }] = useMutation(
    UpdateHomeDocument,
    {
      // The mutation returns updated scalar fields; Apollo merges by
      // __typename + id.
      onError: error => {
        alertService.alert(
          t('labels.error'),
          // Code-resolved, with this site's own copy as the fallback. The
          // server's `message` is English by construction.
          localizedErrorMessage(error, t('errors.updateHomeNameFailed')),
        );
      },
    },
  );

  /**
   * `home` is the CACHED ROW, not a stub: the revert reads its previous values
   * off it, and a key the row lacks is a field the revert leaves alone.
   */
  const updateHomeFields = (
    updates: HomeFieldUpdates,
    home: (HomeFieldUpdates & { version: number }) | null,
    logLabel: string,
  ) =>
    updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: { __typename: 'Home', id: homeId },
      updates,
      // Omits a key the read never carried, so the revert leaves that field
      // alone rather than writing a fallback over it.
      previous: snapshotFields(home, updates),
      logLabel,
      mutate: () =>
        updateHomeMutation({
          variables: {
            input: { id: homeId, ...updates, version: home?.version ?? 1 },
          },
          context: { localFirst: true },
        }),
    });

  return { updateHomeFields, updating };
}
