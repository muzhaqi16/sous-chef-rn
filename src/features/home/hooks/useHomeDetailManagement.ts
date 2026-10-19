import { useRef, useState } from 'react';
import type { DocumentNode } from 'graphql';
import { alertService } from '#/services/alertService';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import {
  useApolloClient,
  useFragment,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import { useUpdateHomeFields } from '#features/home/hooks/useUpdateHomeFields';
import { HomeDetailScreen_HomeFragmentDoc } from '#features/home/screens/HomeDetailScreen.generated';
import {
  GetHomeDocument,
  EnableHomeJoinLinkDocument,
  UpdateHomeJoinCodeDocument,
  TransferHomeOwnershipDocument,
  UpdateMembershipDocument,
  RemoveMemberDocument,
  DeleteHomeInviteDocument,
  LeaveHomeDocument,
  GetHomesDocument,
} from '#operations/home/home.generated';
import { useMarkHomeAsDefault } from '#features/home/hooks/useMarkHomeAsDefault';
import {
  MembershipRole,
  type UpdateMembershipInput,
} from '#/graphql/generated/schemaTypes';

/** The per-member permission overrides `updateMembership` accepts. */
export type MembershipPermissionKey =
  | 'canAddItems'
  | 'canRemoveItems'
  | 'canEditPantry'
  | 'canViewPantry'
  | 'canInviteOthers'
  | 'canManageHome';
import { t, type TranslationKey } from '#/i18n';
import {
  createRemoveFromParentConnectionUpdater,
  safeEvict,
} from '#/apollo/utils/cacheUpdaters';
import {
  settleMutation,
  type SettleStatus,
} from '#/apollo/utils/settleMutation';
import { chainVersionedWrite } from '#/apollo/utils/entityWriteChain';
import { appliedPayload, isAlreadyGone } from '#/utils/errors/mutationPayload';
import { extractNodes } from '#/utils/connectionUtils';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import {
  useAppStore,
  useHomeState,
  useSelectedHomeId,
  useSetSelectedPantryId,
} from '#store/useAppStore';

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

export interface RolePickerState {
  visible: boolean;
  membershipId: string;
  currentRole: MembershipRole | null;
  memberName: string;
}

/**
 * Key paths, not labels — this array is module-level, so calling t() here would
 * bake in whatever language was active at import time.
 */
export const ROLE_OPTIONS: {
  labelKey: TranslationKey;
  value: MembershipRole;
}[] = [
  { labelKey: 'homeRoles.owner', value: MembershipRole.Owner },
  { labelKey: 'labels.admin', value: MembershipRole.Admin },
  { labelKey: 'homeRoles.member', value: MembershipRole.Member },
  { labelKey: 'labels.guest', value: MembershipRole.Guest },
];

const INITIAL_ROLE_PICKER_STATE: RolePickerState = {
  visible: false,
  membershipId: '',
  currentRole: null,
  memberName: '',
};

/**
 * Custom hook for HomeDetailScreen business logic
 * Manages home details, members, and invites
 */
export function useHomeDetailManagement(homeId: string) {
  const client = useApolloClient();
  // Store state and actions for managing selections after leaving
  const selectedHomeId = useSelectedHomeId();
  const { setSelectedHomeId } = useHomeState();
  const setSelectedPantryId = useSetSelectedPantryId();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-and-network: Shows cached data immediately, then fetches full HomeFragment
  // - errorPolicy: 'all' returns cached data AND errors (needed to distinguish "not found" from "failed to load")

  // Query
  const { data, loading, error, refetch } = useQuery(GetHomeDocument, {
    variables: { homeId },
  });

  // Mutations
  const { updateHomeFields } = useUpdateHomeFields(homeId);
  const { requireVerifiedEmail } = useVerifiedEmailGate();
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

  const { markAsDefault } = useMarkHomeAsDefault();

  const [leaveHomeMutation, { loading: leaving }] =
    useMutation(LeaveHomeDocument);

  /**
   * Takes the left home out of the cache and moves the selection on. Run for
   * every leave that did not fail — a repeat the server answers as converged or
   * as not found included, which carries no membership for an `update` to read.
   */
  const removeLeftHome = () => {
    safeEvict(client.cache, 'Home', homeId);
    if (homeId !== selectedHomeId) return;

    const cachedData = client.cache.readQuery({ query: GetHomesDocument });
    const [newDefaultHome] = extractNodes(cachedData?.homes);
    if (newDefaultHome) {
      setSelectedHomeId(newDefaultHome.id);
      setSelectedPantryId(null);
      // Background sync: a refusal is reported where it is written.
      void markAsDefault(newDefaultHome.id);
    } else {
      setSelectedHomeId(null);
      setSelectedPantryId(null);
    }
    // Clear shopping list selection (may have belonged to left home)
    setSelectedShoppingListId(null);
  };

  // `errorPolicy: 'ignore'` yields undefined on error, so the last good data is
  // kept. `!complete` shows the loader: partial data renders an owner as a
  // non-owner while `myMembership.role` is absent.
  const homeRef = usePreservedQueryData(data?.home, null, homeId);
  const { data: unmaskedData, complete: unmaskedComplete } = useFragment({
    fragment: HomeDetailScreen_HomeFragmentDoc,
    fragmentName: 'HomeDetailScreen_home',
    from: homeRef ? { __typename: 'Home', id: homeId } : null,
  });
  const home = homeRef && unmaskedComplete ? unmaskedData : null;

  // CRUD operations utilities
  const { createRemoveOperation } = useCrudOperations();

  /**
   * Local-first: an absolute field set keyed by the home id, written to the
   * cache before firing and idempotent on a queued replay. The server requires
   * the version for its optimistic-concurrency check.
   */
  const saveName = async (name: string) => {
    if (!home) return;
    await updateHomeFields({ name }, home, t('errors.updateHomeNameFailed'));
  };

  // Role picker state (drives ModalPicker in the screen)
  const [rolePickerState, setRolePickerState] = useState<RolePickerState>(
    INITIAL_ROLE_PICKER_STATE,
  );

  const openRolePicker = (
    membershipId: string,
    currentRole: MembershipRole,
    memberName: string,
  ) => {
    setRolePickerState({
      visible: true,
      membershipId,
      currentRole,
      memberName,
    });
  };

  const closeRolePicker = () => {
    setRolePickerState(INITIAL_ROLE_PICKER_STATE);
  };

  const handleRoleSelect = async (value: MembershipRole) => {
    const { membershipId, currentRole } = rolePickerState;
    closeRolePicker();
    if (value === currentRole) return;
    await updateMembership(membershipId, { role: value });
  };

  // Toggle a single membership permission override. updateMembership returns the
  // updated member (HomeMemberCard_member), so Apollo normalizes it and the
  // toggle reflects the server state.
  const updateMemberPermission = (
    membershipId: string,
    permission: MembershipPermissionKey,
    value: boolean,
  ) => updateMembership(membershipId, { [permission]: value });

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
            onConflictRefresh: () => {
              void refetch();
            },
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
    if (left) removeLeftHome();
    return left;
  };

  const toggleJoinCode = async (enabled: boolean) => {
    // Only minting a join link is gated; revoking one stays available so an
    // unverified account can always close off a home it already opened.
    if (enabled && !requireVerifiedEmail()) return;

    if (enabled) {
      // Dedicated mutation: mints a joinCode + join link server-side.
      await settleWrite(EnableHomeJoinLinkDocument, () =>
        enableJoinLinkMutation({ variables: { input: { id: homeId } } }),
      );
      return;
    }
    // No disableHomeJoinLink mutation — the flag is cleared via updateHome.
    if (!home) return;
    await updateHomeFields(
      { allowJoinCode: false },
      home,
      t('errors.updateHomeFailed'),
    );
  };

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

  // Rotate the join code to invalidate a leaked link.
  const rotateJoinCode = () =>
    settleWrite(UpdateHomeJoinCodeDocument, () =>
      rotateJoinCodeMutation({ variables: { input: { id: homeId } } }),
    );

  return {
    // Data
    home,
    loading,
    error,
    leaving,
    refetch,

    // Role picker
    rolePickerState,
    handleRoleSelect,
    closeRolePicker,

    // Actions
    saveName,
    changeRole: openRolePicker,
    removeMember,
    revokeInvite,
    leaveHome,
    toggleJoinCode,
    rotateJoinCode,
    rotatingJoinCode,
    transferOwnership,
    transferringOwnership,
    updateMemberPermission,
  };
}
