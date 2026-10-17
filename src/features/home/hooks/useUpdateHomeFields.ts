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
 * Local-first and idempotent on a queued replay. Its own module because
 * `localFirstReplaySafety` reads a FILE for `localFirst` and holds every
 * operation that file names.
 */
export function useUpdateHomeFields(homeId: string) {
  const client = useApolloClient();
  // The mutation returns updated scalar fields; Apollo merges by __typename + id.
  const [updateHomeMutation] = useMutation(UpdateHomeDocument, {
    context: { localFirst: true },
  });

  /**
   * `home` is the CACHED ROW, not a stub: the revert reads previous values off
   * it. `fallback` is the copy a failure shows when its code has none. True when
   * the change landed or is queued.
   */
  const updateHomeFields = async (
    updates: HomeFieldUpdates,
    home: (HomeFieldUpdates & { version: number }) | null,
    fallback: string,
  ): Promise<boolean> => {
    return updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: { __typename: 'Home', id: homeId },
      updates,
      // Omits a key the read never carried, so the revert leaves that field
      // alone rather than writing a fallback over it.
      previous: snapshotFields(home, updates),
      settle: () =>
        settleMutation(
          () =>
            updateHomeMutation({
              variables: {
                input: { id: homeId, ...updates, version: home?.version ?? 1 },
              },
            }),
          { document: UpdateHomeDocument, fallback },
        ),
    });
  };

  return { updateHomeFields };
}
