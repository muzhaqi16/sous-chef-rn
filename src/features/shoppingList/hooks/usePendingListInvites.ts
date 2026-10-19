import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  ErrorCode,
  type CollaboratorRole,
} from '#/graphql/generated/schemaTypes';
import { isGoneCode, type SettledFailure } from '#/apollo/utils/settleMutation';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import { destructiveConfirm } from '#/services/destructiveConfirm';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import { extractNodes } from '#/utils/connectionUtils';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { useTranslation } from '#/i18n';
import { GetPendingListInvitesDocument } from './usePendingListInvites.generated';
import { useAnswerListInvite } from './useAnswerListInvite';

const PENDING_INVITES_PAGE_SIZE = 20;

export interface PendingListInvite {
  id: string;
  listName: string;
  inviterName: string | null;
  role: CollaboratorRole;
}

/** The answer in flight, which holds every invite's buttons until it settles. */
export interface PendingAnswer {
  inviteId: string;
  answer: 'accept' | 'decline';
}

export interface PendingListInvitesOptions {
  /** Selects the list an accept joined. */
  onAccepted: (listId: string) => void;
  /** `useVerifiedEmailGate`'s, from inside the navigator: the sheet is outside it. */
  requireVerifiedEmail: () => boolean;
}

/**
 * The invites waiting on the reader's answer, answered by id: an invitee with
 * invite notifications off never received the token.
 */
export function usePendingListInvites({
  onAccepted,
  requireVerifiedEmail,
}: PendingListInvitesOptions) {
  const { t } = useTranslation();
  const { acceptListInvite, declineListInvite } = useAnswerListInvite();
  const [answering, setAnswering] = useState<PendingAnswer | null>(null);
  const { data, refetch } = useQuery(GetPendingListInvitesDocument, {
    variables: { first: PENDING_INVITES_PAGE_SIZE },
  });

  const invites: PendingListInvite[] = extractNodes(
    data?.me?.pendingCollaborationInvitesConnection,
  ).map(invite => ({
    id: invite.id,
    listName: invite.shoppingList.name,
    inviterName: firstNonBlank(invite.inviterName) ?? null,
    role: invite.role,
  }));

  const reportFailure = (failure: SettledFailure) => {
    // The answer's update already dropped a gone invite; the others may have
    // moved with it.
    if (isGoneCode(failure.code)) void refetch();
    // Signed in as somebody else, which no retry fixes.
    if (failure.code === ErrorCode.Forbidden) {
      alertService.alert(failure.title, failure.body);
      return;
    }
    toastService.error(failure.body);
  };

  const answer = (
    pending: PendingAnswer,
    write: () => Promise<void>,
    fallback: string,
  ) => {
    setAnswering(pending);
    void executeAsyncWithCleanup(
      write,
      () => setAnswering(null),
      () => toastService.error(fallback),
    );
  };

  // By id both answers need a verified email; the gate says so and offers the
  // way to verify, with the invite still pending afterwards.
  const accept = (invite: PendingListInvite) => {
    if (!requireVerifiedEmail()) return;
    answer(
      { inviteId: invite.id, answer: 'accept' },
      async () => {
        const outcome = await acceptListInvite({ inviteId: invite.id });
        if (outcome.status === 'failed') {
          reportFailure(outcome.failure);
          return;
        }
        toastService.success(
          t('toasts.canCollaborateOn', { name: invite.listName }),
        );
        if (outcome.listId) onAccepted(outcome.listId);
      },
      t('invitationAcceptance.acceptFailed'),
    );
  };

  const decline = (invite: PendingListInvite) => {
    if (!requireVerifiedEmail()) return;
    alertService.alert(
      t('confirmations.declineInvitationTitle'),
      t('confirmations.declineInvitation', { entityName: invite.listName }),
      destructiveConfirm(t('labels.decline'), () => {
        answer(
          { inviteId: invite.id, answer: 'decline' },
          async () => {
            const outcome = await declineListInvite({ inviteId: invite.id });
            if (outcome.status === 'failed') {
              reportFailure(outcome.failure);
              return;
            }
            toastService.success(
              t('success.invitationDeclinedTo', {
                entityName: invite.listName,
              }),
            );
          },
          t('invitationAcceptance.declineFailed'),
        );
      }),
    );
  };

  return { invites, answering, accept, decline };
}
