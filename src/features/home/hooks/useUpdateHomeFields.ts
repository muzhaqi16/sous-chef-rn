import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateHomeDocument } from '#operations/home/home.generated';
import { sendFields } from '#/apollo/pendingWrites/sendFields';

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
  const client = useApolloClient();
  // The mutation returns updated scalar fields; Apollo merges by __typename + id.
  const [updateHomeMutation] = useMutation(UpdateHomeDocument, {
    context: { localFirst: true },
  });

  /**
   * `home` states the version the edit builds on. `fallback` is the copy a
   * failure shows when its code has none. True when the change landed or is
   * queued.
   */
  const updateHomeFields = async (
    updates: HomeFieldUpdates,
    home: { version: number },
    fallback: string,
  ): Promise<boolean> => {
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'Home', id: homeId },
      fields: updates,
      variables: { input: { id: homeId, ...updates, version: home.version } },
      mutate: updateHomeMutation,
      settle: { document: UpdateHomeDocument, fallback },
    });
    return settled.status !== 'failed';
  };

  return { updateHomeFields };
}
