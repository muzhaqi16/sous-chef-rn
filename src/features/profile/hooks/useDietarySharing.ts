import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { sendFields } from '#/apollo/pendingWrites/sendFields';
import { generateEntityId } from '#/utils/generateEntityId';
import { errorService } from '#/services/errorService';
import {
  DietarySharingHomesDocument,
  UpdateDietarySharingDocument,
} from './useDietarySharing.generated';

/** One of the caller's homes, and whether it sees their restrictions. */
export interface DietarySharingHome {
  id: string;
  name: string;
  shared: boolean;
}

/**
 * The caller's homes with their own dietary sharing switch in each, and the
 * write that flips one, which holds offline and queues; a refusal says why and
 * shows the server's state.
 */
export function useDietarySharing() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { data, refetch } = useQuery(DietarySharingHomesDocument);
  const [mutate] = useMutation(UpdateDietarySharingDocument, {
    context: { localFirst: true },
  });

  const memberships = (data?.homes.edges ?? []).flatMap(({ node }) =>
    node.myMembership ? [{ home: node, membership: node.myMembership }] : [],
  );

  const setShared = async (homeId: string, shared: boolean) => {
    const entry = memberships.find(({ home }) => home.id === homeId);
    if (!entry) return;
    // One key per toggle: a queued toggle resent on reconnect writes nothing
    // twice, and a late "off" never undoes a later "on".
    const idempotencyKey = generateEntityId();
    await sendFields(client.cache, {
      entity: { __typename: 'Membership', id: entry.membership.id },
      fields: { sharesDietaryNeeds: shared },
      variables: { input: { homeId, shared, idempotencyKey } },
      mutate,
      settle: {
        document: UpdateDietarySharingDocument,
        fallback: t('dietary.sharingFailed'),
        present: 'toast',
        // A later toggle the server took may stand: show what it holds.
        onFailed: () => {
          void refetch().catch(error =>
            errorService.reportError(error, {
              operation: 'DietarySharing.refetch',
            }),
          );
        },
      },
    });
  };

  const homes: DietarySharingHome[] = memberships.map(
    ({ home, membership }) => ({
      id: home.id,
      name: home.name,
      shared: membership.sharesDietaryNeeds,
    }),
  );

  return { homes, setShared };
}
