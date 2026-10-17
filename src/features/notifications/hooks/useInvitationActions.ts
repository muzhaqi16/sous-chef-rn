import type { ApolloCache } from '@apollo/client';
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
  type Settled,
  type SettledFailure,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import {
  appliedPayload,
  extractMutationPayload,
} from '#/utils/errors/mutationPayload';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { useTranslation } from '#/i18n';
import { ErrorCode } from '#/graphql/generated/schemaTypes';

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

const writeResult = ({
  failure,
}: Pick<Settled<unknown>, 'failure'>): InvitationWriteResult =>
  failure ? { status: 'failed', failure } : { status: 'done' };

/**
 * The invite is not pending any more: the server refused the write as a plain
 * conflict. A full home is a `ConflictError` too, under its own code, and its
 * invite stays pending until a seat frees.
 */
const isSpentInvite = (data: unknown): boolean => {
  const payload = extractMutationPayload(data);
  return (
    payload?.__typename === 'ConflictError' &&
    payload.code === ErrorCode.Conflict
  );
};

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
 * Each `update` prefers the payload's `inviteId`, else `invitation.id` (the
 * server's `sourceId`), so a notification carrying only a sourceId still evicts
 * its pending record.
 */
export function useInvitationActions(
  invitation: InvitationData | null,
  userId: string | null,
) {
  const { t } = useTranslation();
  const inviteId = firstNonBlank(invitation?.payload.inviteId, invitation?.id);

  /**
   * `update` runs for a refusal too. Only a CONFLICT means spent (accepted,
   * declined or revoked); any other refusal leaves the invite PENDING, so
   * evicting it would leave nothing to accept later.
   */
  const dropSpentHomeInvite = (cache: ApolloCache, data: unknown) => {
    if (isSpentInvite(data) && inviteId && userId) {
      removePendingHomeInvite(cache, userId, inviteId, { evictItem: true });
    }
  };

  const [acceptHomeInvite] = useMutation(AcceptHomeInviteDocument, {
    update: (cache, { data }) => {
      const payload = appliedPayload(data);
      if (!payload) {
        dropSpentHomeInvite(cache, data);
        return;
      }
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
      if (!payload) {
        dropSpentHomeInvite(cache, data);
        return;
      }
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
   * The bearer token rides only in the notification that delivered it: the API
   * stores a digest, so no lookup can hand one back. Read at render so a
   * surface holding none can decline to offer the action.
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
    return writeResult(settled);
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
    return writeResult(settled);
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
    return writeResult(settled);
  };

  return { token, acceptHome, acceptList, declineHome, declineList };
}
