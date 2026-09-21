import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateHomeDocument } from '#operations/home/home.generated';
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
import { settleMutation } from '#/apollo/utils/settleMutation';

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
  // The mutation returns updated scalar fields; Apollo merges by __typename + id.
  const [updateHomeMutation] = useMutation(UpdateHomeDocument);

  /**
   * `home` is the CACHED ROW, not a stub: the revert reads its previous values
   * off it, and a key the row lacks is a field the revert leaves alone.
   * `fallback` is the copy a failure shows when its code has none. True when
   * the change landed or is queued.
   */
  const updateHomeFields = async (
    updates: HomeFieldUpdates,
    home: (HomeFieldUpdates & { version: number }) | null,
    fallback: string,
  ): Promise<boolean> => {
    const { persisted } = await updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: { __typename: 'Home', id: homeId },
      updates,
      // Omits a key the read never carried, so the revert leaves that field
      // alone rather than writing a fallback over it.
      previous: snapshotFields(home, updates),
      logLabel: 'Update Home Fields',
      mutate: async () => {
        const settled = await settleMutation(
          () =>
            updateHomeMutation({
              variables: {
                input: { id: homeId, ...updates, version: home?.version ?? 1 },
              },
              context: { localFirst: true },
            }),
          { document: UpdateHomeDocument, fallback },
        );
        // The settled failure stands in for the error, so the revert runs
        // exactly when a failure was presented.
        return { data: settled.data, error: settled.failure };
      },
    });
    return persisted;
  };

  return { updateHomeFields };
}
