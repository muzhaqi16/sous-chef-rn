import { useMutation } from '@apollo/client/react';
import {
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import {
  InvitationAcceptanceModalAcceptShoppingListInviteDocument,
  InvitationAcceptanceModalDeclineShoppingListInviteDocument,
} from '#features/notifications/components/InvitationAcceptanceModal.generated';
import type { InvitationData } from '#features/notifications/types';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  safeEvict,
} from '#/apollo/utils/cacheUpdaters';

const addToHomes = createAddToQueryConnectionUpdater('homes', 'Home');
const removePendingHomeInvite = createRemoveFromParentConnectionUpdater(
  'User',
  'pendingHomeInvitesConnection',
  'HomeInvite',
);
const removePendingCollaborationInvite =
  createRemoveFromParentConnectionUpdater(
    'User',
    'pendingCollaborationInvitesConnection',
    'ShoppingListCollaborator',
  );

/** What a write returned. `error` is passed to the caller's copy resolver. */
export interface InvitationWriteResult {
  error?: unknown;
  /** Set only by `acceptHome`, and only when the server accepted. */
  acceptedHomeId?: string;
  accepted?: boolean;
}

/**
 * The four invite writes and the token lookup behind them. Each `update`
 * prefers the payload's `inviteId` and falls back to the canonical
 * `invitation.id` (the server's `sourceId` correlation), so a notification
 * carrying only a sourceId still evicts its pending record.
 */
export function useInvitationActions(
  invitation: InvitationData | null,
  userId: string | null,
) {
  const inviteId = invitation?.payload?.inviteId || invitation?.id;

  const [acceptHomeInvite] = useMutation(AcceptHomeInviteDocument, {
    update: (cache, { data }) => {
      const payload = data?.acceptHomeInvite;
      if (payload?.__typename === 'AcceptHomeInvitePayload') {
        addToHomes(cache, payload.membership.home, { position: 'end' });
      }
      if (inviteId && userId) {
        removePendingHomeInvite(cache, userId, inviteId, { evictItem: true });
      }
    },
  });

  const [acceptShoppingListInvite] = useMutation(
    InvitationAcceptanceModalAcceptShoppingListInviteDocument,
    {
      update: (cache, { data }) => {
        if (
          data?.acceptShoppingListInvite?.__typename !==
          'AcceptShoppingListInvitePayload'
        ) {
          return;
        }
        // Not evicted: accepting transitions the pending collaborator record to
        // active, and Apollo has already normalized the response — only the
        // reference has to leave the pending list.
        if (inviteId && userId) {
          removePendingCollaborationInvite(cache, userId, inviteId);
        }
      },
    },
  );

  const [declineHomeInvite] = useMutation(DeclineHomeInviteDocument, {
    update: (cache, { data }) => {
      const payload = data?.declineHomeInvite;
      if (payload?.__typename !== 'DeclineHomeInvitePayload') return;
      const id = payload.homeInvite.id;
      if (id && userId) {
        removePendingHomeInvite(cache, userId, id, { evictItem: true });
      } else if (id) {
        safeEvict(cache, 'HomeInvite', id);
      }
    },
  });

  const [declineShoppingListInvite] = useMutation(
    InvitationAcceptanceModalDeclineShoppingListInviteDocument,
    {
      update: cache => {
        if (inviteId && userId) {
          removePendingCollaborationInvite(cache, userId, inviteId, {
            evictItem: true,
          });
        }
      },
    },
  );

  /**
   * The invite's bearer token, which rides in the notification that delivered
   * it. No lookup behind this: the API discloses the raw token once, to the
   * inviter, and stores only a digest, so no list can hand one back. Absent
   * means the caller reports the invite as unavailable.
   */
  const resolveToken = async (): Promise<string | undefined> =>
    invitation?.token;

  const acceptHome = async (token: string): Promise<InvitationWriteResult> => {
    const result = await acceptHomeInvite({ variables: { input: { token } } });
    if (result.error) return { error: result.error };
    const payload = result.data?.acceptHomeInvite;
    return payload?.__typename === 'AcceptHomeInvitePayload'
      ? { accepted: true, acceptedHomeId: payload.membership.homeId }
      : { accepted: false };
  };

  const acceptList = async (token: string): Promise<InvitationWriteResult> => {
    const result = await acceptShoppingListInvite({
      variables: { input: { token } },
    });
    if (result.error) return { error: result.error };
    return {
      accepted:
        result.data?.acceptShoppingListInvite?.__typename ===
        'AcceptShoppingListInvitePayload',
    };
  };

  const declineHome = async (token: string): Promise<InvitationWriteResult> => {
    const result = await declineHomeInvite({ variables: { input: { token } } });
    return { error: result.error };
  };

  const declineList = async (token: string): Promise<InvitationWriteResult> => {
    const result = await declineShoppingListInvite({
      variables: { input: { token } },
    });
    return { error: result.error };
  };

  return { resolveToken, acceptHome, acceptList, declineHome, declineList };
}
