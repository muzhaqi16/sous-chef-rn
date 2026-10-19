import type { ApolloCache } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { invitationRefusalCopy } from '#/domain/invitationRefusal';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import {
  settleMutation,
  type SettledFailure,
  type SettleOptions,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';
import { useUserId } from '#store/useAppStore';
import {
  ErrorCode,
  type AcceptShoppingListInviteInput,
  type DeclineShoppingListInviteInput,
} from '#/graphql/generated/schemaTypes';
import {
  AcceptShoppingListInviteDocument,
  DeclineShoppingListInviteDocument,
  type AcceptShoppingListInviteMutation,
  type DeclineShoppingListInviteMutation,
} from '#features/shoppingList/graphql/collaboration.generated';
import { addShoppingListToQueryCache } from '#features/shoppingList/cache/list';

const removePendingInvite = createRemoveFromParentConnectionUpdater(
  'User',
  'pendingCollaborationInvitesConnection',
  'ShoppingListCollaborator',
);

/** What an answer did. `listId` is the list an applied accept joined. */
export type ListInviteAnswer =
  | { status: 'done'; listId: string | null }
  | { status: 'failed'; failure: SettledFailure };

type AnswerResult =
  | AcceptShoppingListInviteMutation['acceptShoppingListInvite']
  | DeclineShoppingListInviteMutation['declineShoppingListInvite'];

/**
 * Named by id, the invite is gone for good: answered or revoked elsewhere
 * (`NotFoundError`), or past its expiry (a `ValidationError` on `inviteId`).
 * By token neither is checked, so a notification keeps its invite.
 */
const isSpentById = (result: AnswerResult | undefined): boolean =>
  result?.__typename === 'NotFoundError' ||
  (result?.__typename === 'ValidationError' && result.field === 'inviteId');

/**
 * Accept or decline a shopping-list invite, by its token (a notification or a
 * link) or by its id (the pending list). The response names the invite: the
 * collaborator record a pending invite is, so it leaves the pending list.
 */
export function useAnswerListInvite() {
  const { t } = useTranslation();
  const userId = useUserId();

  const dropInvite = (
    cache: ApolloCache,
    inviteId: string,
    evictItem: boolean,
  ) => {
    if (userId) removePendingInvite(cache, userId, inviteId, { evictItem });
  };

  const dropIfSpent = (
    cache: ApolloCache,
    result: AnswerResult | undefined,
    inviteId: string | null | undefined,
  ) => {
    if (inviteId && isSpentById(result)) dropInvite(cache, inviteId, true);
  };

  const [accept] = useMutation(AcceptShoppingListInviteDocument, {
    update: (cache, { data }, { variables }) => {
      const payload = appliedPayload(data);
      if (!payload) {
        dropIfSpent(
          cache,
          data?.acceptShoppingListInvite,
          variables?.input.inviteId,
        );
        return;
      }
      // Kept in the cache: the invite record is now the active collaborator.
      dropInvite(cache, payload.collaborator.id, false);
      if (payload.shoppingList) {
        addShoppingListToQueryCache(cache, payload.shoppingList);
      }
    },
  });

  const [decline] = useMutation(DeclineShoppingListInviteDocument, {
    update: (cache, { data }, { variables }) => {
      const payload = appliedPayload(data);
      if (payload) {
        dropInvite(cache, payload.collaborator.id, true);
        return;
      }
      dropIfSpent(
        cache,
        data?.declineShoppingListInvite,
        variables?.input.inviteId,
      );
    },
  });

  const options = (
    reference: AcceptShoppingListInviteInput,
    document: DocumentNode,
    fallback: string,
  ): SettleOptions => {
    const copy = invitationRefusalCopy();
    return {
      document,
      fallback,
      present: 'none',
      // By token a refused one names no invite or an expired one; by id the
      // invite exists, so only its expiry is left.
      copy: reference.inviteId
        ? {
            ...copy,
            [ErrorCode.ValidationFailed]: {
              title: t('labels.error'),
              body: t('listInvites.expired'),
            },
          }
        : copy,
    };
  };

  const acceptListInvite = async (
    reference: AcceptShoppingListInviteInput,
  ): Promise<ListInviteAnswer> => {
    const settled = await settleMutation(
      () => accept({ variables: { input: reference } }),
      options(
        reference,
        AcceptShoppingListInviteDocument,
        t('invitationAcceptance.acceptFailed'),
      ),
    );
    if (settled.failure) return { status: 'failed', failure: settled.failure };
    const accepted = appliedPayload(settled.data);
    return { status: 'done', listId: accepted?.shoppingList?.id ?? null };
  };

  const declineListInvite = async (
    reference: DeclineShoppingListInviteInput,
  ): Promise<ListInviteAnswer> => {
    const settled = await settleMutation(
      () => decline({ variables: { input: reference } }),
      options(
        reference,
        DeclineShoppingListInviteDocument,
        t('invitationAcceptance.declineFailed'),
      ),
    );
    if (settled.failure) return { status: 'failed', failure: settled.failure };
    return { status: 'done', listId: null };
  };

  return { acceptListInvite, declineListInvite };
}
