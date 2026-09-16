import { useMutation } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { invitationRefusalCopy } from '#/domain/invitationRefusal';
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
import {
  settleMutation,
  type SettledFailure,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { useTranslation } from '#/i18n';

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

export type InvitationFailure = SettledFailure;

/** What a write did. `acceptedHomeId` is set only by an applied `acceptHome`. */
export type InvitationWriteResult =
  | { status: 'done'; acceptedHomeId?: string }
  | { status: 'failed'; failure: InvitationFailure };

const refusalOptions = (
  document: DocumentNode,
  fallback: string,
): SettleOptions => ({
  document,
  fallback,
  copy: invitationRefusalCopy(),
  present: 'none',
});

/**
 * The four invite writes and the token they need. Each `update`
 * prefers the payload's `inviteId` and falls back to the canonical
 * `invitation.id` (the server's `sourceId` correlation), so a notification
 * carrying only a sourceId still evicts its pending record.
 */
export function useInvitationActions(
  invitation: InvitationData | null,
  userId: string | null,
) {
  const { t } = useTranslation();
  const inviteId = firstNonBlank(invitation?.payload.inviteId, invitation?.id);

  const [acceptHomeInvite] = useMutation(AcceptHomeInviteDocument, {
    update: (cache, { data }) => {
      // A refusal is a completed mutation, so this runs for one too. Every
      // effect stays inside the payload check: the invite is still PENDING on
      // a refusal, and evicting it here leaves nothing to accept later.
      const payload = appliedPayload(data);
      if (!payload) return;
      addToHomes(cache, payload.membership.home, { position: 'end' });
      if (inviteId && userId) {
        removePendingHomeInvite(cache, userId, inviteId, { evictItem: true });
      }
    },
  });

  const [acceptShoppingListInvite] = useMutation(
    InvitationAcceptanceModalAcceptShoppingListInviteDocument,
    {
      update: (cache, { data }) => {
        if (!appliedPayload(data)) return;
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
      const payload = appliedPayload(data);
      if (!payload) return;
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
      update: (cache, { data }) => {
        if (!appliedPayload(data)) return;
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
   * it. There is no lookup behind it: the API discloses the raw token once, to
   * the inviter, and stores only a digest, so no list can hand one back. Read
   * at render so a surface holding none can decline to offer the action at all.
   */
  const token = invitation?.token;

  const acceptHome = async (
    inviteToken: string,
  ): Promise<InvitationWriteResult> => {
    const settled = await settleMutation(
      () => acceptHomeInvite({ variables: { input: { token: inviteToken } } }),
      refusalOptions(
        AcceptHomeInviteDocument,
        t('invitationAcceptance.acceptFailed'),
      ),
    );
    if (settled.failure) return { status: 'failed', failure: settled.failure };
    const accepted = appliedPayload(settled.data);
    return { status: 'done', acceptedHomeId: accepted?.membership.homeId };
  };

  const acceptList = async (
    inviteToken: string,
  ): Promise<InvitationWriteResult> => {
    const settled = await settleMutation(
      () =>
        acceptShoppingListInvite({
          variables: { input: { token: inviteToken } },
        }),
      refusalOptions(
        InvitationAcceptanceModalAcceptShoppingListInviteDocument,
        t('invitationAcceptance.acceptFailed'),
      ),
    );
    return settled.failure
      ? { status: 'failed', failure: settled.failure }
      : { status: 'done' };
  };

  const declineHome = async (
    inviteToken: string,
  ): Promise<InvitationWriteResult> => {
    const settled = await settleMutation(
      () => declineHomeInvite({ variables: { input: { token: inviteToken } } }),
      refusalOptions(
        DeclineHomeInviteDocument,
        t('invitationAcceptance.declineFailed'),
      ),
    );
    return settled.failure
      ? { status: 'failed', failure: settled.failure }
      : { status: 'done' };
  };

  const declineList = async (
    inviteToken: string,
  ): Promise<InvitationWriteResult> => {
    const settled = await settleMutation(
      () =>
        declineShoppingListInvite({
          variables: { input: { token: inviteToken } },
        }),
      refusalOptions(
        InvitationAcceptanceModalDeclineShoppingListInviteDocument,
        t('invitationAcceptance.declineFailed'),
      ),
    );
    return settled.failure
      ? { status: 'failed', failure: settled.failure }
      : { status: 'done' };
  };

  return { token, acceptHome, acceptList, declineHome, declineList };
}
