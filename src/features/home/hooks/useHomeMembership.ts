import { useRef } from 'react';
import type { DocumentNode } from 'graphql';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import {
  EnableHomeJoinLinkDocument,
  UpdateHomeJoinCodeDocument,
  TransferHomeOwnershipDocument,
  UpdateMembershipDocument,
  RemoveMemberDocument,
  DeleteHomeInviteDocument,
  LeaveHomeDocument,
  DeleteHomeDocument,
} from '#operations/home/home.generated';
import type { UpdateMembershipInput } from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import {
  settleMutation,
  type SettleStatus,
} from '#/apollo/utils/settleMutation';
import { chainVersionedWrite } from '#/apollo/utils/entityWriteChain';
import { appliedPayload, isAlreadyGone } from '#/utils/errors/mutationPayload';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { forgetHome } from '#/domain/forgetHome';
import { useMarkHomeAsDefault } from './useMarkHomeAsDefault';

const removeFromMembers = createRemoveFromParentConnectionUpdater(
  'Home',
  'membersConnection',
  'Membership',
);
const removeFromInvites = createRemoveFromParentConnectionUpdater(
  'Home',
  'invitesConnection',
  'HomeInvite',
);

/** A removal landed, or the server says its row is already gone. */
const removalLanded = <TData>(data: TData | null | undefined) =>
  !!appliedPayload(data) || isAlreadyGone(data);

/**
 * The writes on a home's membership: its join link, ownership, members,
 * invites, leaving it, and its owner deleting it. Each settles through `settleMutation` and alerts a
 * refusal; each resolves whether it landed or queued. `onConflictRefresh`
 * re-reads the home when a member removal meets a newer version.
 */
export function useHomeMembership(
  homeId: string,
  { onConflictRefresh }: { onConflictRefresh?: () => void } = {},
) {
  const client = useApolloClient();
  const { markAsDefault } = useMarkHomeAsDefault();
  const { createRemoveOperation } = useCrudOperations();

  const [enableJoinLinkMutation] = useMutation(EnableHomeJoinLinkDocument);
  const [rotateJoinCodeMutation, { loading: rotatingJoinCode }] = useMutation(
    UpdateHomeJoinCodeDocument,
  );
  const [transferOwnershipMutation, { loading: transferringOwnership }] =
    useMutation(TransferHomeOwnershipDocument);
  // Read at press time: a confirm dialog opened before the first transfer
  // started still holds that render's `transferringOwnership`.
  const transferInFlight = useRef(false);

  // No update callback: the response normalizes by Membership id. A manual
  // `cache.modify` on a permission-only toggle writes `role: undefined`, which
  // DELETES the field and blanks the card.
  const [updateMembershipMutation] = useMutation(UpdateMembershipDocument);

  const [removeMemberMutation] = useMutation(RemoveMemberDocument, {
    update(cache, { data }, { variables }) {
      if (!variables || !removalLanded(data)) return;
      removeFromMembers(cache, homeId, variables.input.membershipId, {
        evictItem: true,
      });
    },
  });

  const [revokeInviteMutation] = useMutation(DeleteHomeInviteDocument, {
    update(cache, { data }, { variables }) {
      if (!variables || !removalLanded(data)) return;
      removeFromInvites(cache, homeId, variables.input.id, { evictItem: true });
    },
  });

  const [leaveHomeMutation, { loading: leaving }] =
    useMutation(LeaveHomeDocument);
  const [deleteHomeMutation, { loading: deleting }] =
    useMutation(DeleteHomeDocument);

  /** Whether a write landed or queued; a refusal has been alerted. */
  const settleWrite = async (
    document: DocumentNode,
    run: () => Promise<{ data?: unknown; error?: unknown }>,
    fallback = t('errors.updateHomeFailed'),
  ) => {
    const settled = await settleMutation(run, { document, fallback });
    return settled.status !== 'failed';
  };

  /** One membership edit, stating the version the cache holds for that row. */
  const updateMembership = (
    membershipId: string,
    fields: Omit<UpdateMembershipInput, 'id' | 'version'>,
  ) =>
    settleWrite(
      UpdateMembershipDocument,
      () =>
        chainVersionedWrite(
          client.cache,
          { __typename: 'Membership', id: membershipId },
          version =>
            updateMembershipMutation({
              variables: { input: { id: membershipId, ...fields, version } },
            }),
        ),
      t('errors.updateMemberRoleFailed'),
    );

  /**
   * Takes the home out of the cache and moves the selection on. Run for every
   * leave or delete that did not fail — a repeat the server answers as
   * converged or as not found included, which carries no row for an `update`.
   */
  const removeGoneHome = () => {
    const nextHomeId = forgetHome(client.cache, homeId);
    // Background sync: a refusal is reported where it is written.
    if (nextHomeId) void markAsDefault(nextHomeId);
  };

  /** Asks first; resolves whether the removal landed or queued, false on Cancel. */
  const confirmRemoval = (
    title: string,
    body: string,
    action: string,
    remove: () => Promise<{ status: SettleStatus }>,
  ) =>
    new Promise<boolean>(resolve => {
      alertService.alert(title, body, [
        {
          text: t('labels.cancel'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: action,
          style: 'destructive',
          onPress: () => {
            void remove().then(settled => resolve(settled.status !== 'failed'));
          },
        },
      ]);
    });

  // Not `createRemoveOperation`: it sends `{ id }`, and this input's key is
  // `membershipId`.
  const removeMember = (membershipId: string, memberName: string) =>
    confirmRemoval(
      t('confirmations.removeMemberTitle'),
      t('confirmations.removeMemberNamed', { name: memberName }),
      t('labels.remove'),
      () =>
        settleMutation(
          () =>
            removeMemberMutation({ variables: { input: { membershipId } } }),
          {
            document: RemoveMemberDocument,
            fallback: t('errors.removeMemberFailed'),
            removal: true,
            onConflictRefresh,
          },
        ),
    );

  const revokeInvite = (inviteId: string, inviteEmail: string) => {
    const operation = createRemoveOperation({
      mutation: revokeInviteMutation,
      document: DeleteHomeInviteDocument,
      fallback: t('errors.revokeInviteFailed'),
      itemId: inviteId,
      confirmTitle: t('confirmations.revokeInviteTitle'),
      confirmMessage: t('confirmations.revokeInviteNamed', {
        name: inviteEmail,
      }),
    });
    return operation();
  };

  const leaveHome = async (homeName: string): Promise<boolean> => {
    const left = await confirmRemoval(
      t('labels.leaveHome'),
      t('home.leaveBody', { name: homeName }),
      t('labels.leave'),
      () =>
        settleMutation(
          () => leaveHomeMutation({ variables: { input: { homeId } } }),
          {
            document: LeaveHomeDocument,
            fallback: t('errors.codes.genericRetry'),
            removal: true,
          },
        ),
    );
    if (left) removeGoneHome();
    return left;
  };

  const deleteHome = async (homeName: string): Promise<boolean> => {
    const deleted = await confirmRemoval(
      t('confirmations.deleteHomeTitle'),
      t('labels.areYouSureYouWantToDeleteThisCannotBeUndone', {
        name: homeName,
      }),
      t('labels.delete'),
      () =>
        settleMutation(
          () => deleteHomeMutation({ variables: { input: { id: homeId } } }),
          {
            document: DeleteHomeDocument,
            fallback: t('errors.deleteHomeFailed'),
            removal: true,
          },
        ),
    );
    if (deleted) removeGoneHome();
    return deleted;
  };

  /** Mints a join code and its link server-side. */
  const enableJoinLink = () =>
    settleWrite(EnableHomeJoinLinkDocument, () =>
      enableJoinLinkMutation({ variables: { input: { id: homeId } } }),
    );

  // Rotate the join code to invalidate a leaked link.
  const rotateJoinCode = () =>
    settleWrite(UpdateHomeJoinCodeDocument, () =>
      rotateJoinCodeMutation({ variables: { input: { id: homeId } } }),
    );

  // Hand the home off to another member. The server flips the OWNER role; the
  // response carries the refreshed membersConnection so roles update in-place.
  const transferOwnership = async (newOwnerId: string) => {
    if (transferInFlight.current) return false;
    transferInFlight.current = true;
    const transferred = await settleWrite(TransferHomeOwnershipDocument, () =>
      transferOwnershipMutation({
        variables: { input: { homeId, newOwnerId } },
      }),
    );
    transferInFlight.current = false;
    return transferred;
  };

  return {
    updateMembership,
    removeMember,
    revokeInvite,
    leaveHome,
    leaving,
    deleteHome,
    deleting,
    enableJoinLink,
    rotateJoinCode,
    rotatingJoinCode,
    transferOwnership,
    transferringOwnership,
  };
}
