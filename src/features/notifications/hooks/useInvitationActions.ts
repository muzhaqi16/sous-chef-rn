import type { ApolloCache } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { invitationRefusalCopy } from '#/domain/invitationRefusal';
import {
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
} from '#operations/home/home.generated';
import {
  useAnswerListInvite,
  type ListInviteAnswer,
} from '#features/shoppingList/hooks/useAnswerListInvite';
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

export type InvitationFailure = SettledFailure;

/** What a write did. `acceptedHomeId` is set only by an applied `acceptHome`. */
export type InvitationWriteResult =
  | { status: 'done'; acceptedHomeId?: string }
  | { status: 'failed'; failure: InvitationFailure };

const writeResult = ({
  failure,
}: Pick<Settled<unknown>, 'failure'>): InvitationWriteResult =>
  failure ? { status: 'failed', failure } : { status: 'done' };

const fromListAnswer = (answer: ListInviteAnswer): InvitationWriteResult =>
  answer.status === 'failed' ? answer : { status: 'done' };

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
 * Each home `update` prefers the notification's `inviteId`, else
 * `invitation.id` (the server's `sourceId`), so a notification carrying only a
 * sourceId still evicts its pending record. A list invite is answered by
 * `useAnswerListInvite`.
 */
export function useInvitationActions(
  invitation: InvitationData | null,
  userId: string | null,
) {
  const { t } = useTranslation();
  const inviteId = firstNonBlank(invitation?.inviteId, invitation?.id);

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

  const { acceptListInvite, declineListInvite } = useAnswerListInvite();

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
  ): Promise<InvitationWriteResult> =>
    fromListAnswer(await acceptListInvite({ token: inviteToken }));

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
  ): Promise<InvitationWriteResult> =>
    fromListAnswer(await declineListInvite({ token: inviteToken }));

  return { token, acceptHome, acceptList, declineHome, declineList };
}
