import { useRef, useState } from 'react';
import { alertService } from '#/services/alertService';
import { usePreservedQueryData } from '#/hooks/apollo/usePreservedQueryData';
import { useFragment, useMutation, useQuery } from '@apollo/client/react';
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
import { MembershipRole } from '#/graphql/generated/schemaTypes';

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
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { extractNodes } from '#/utils/connectionUtils';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import {
  useAppStore,
  useHomeState,
  useSelectedHomeId,
  useSetSelectedPantryId,
} from '#store/useAppStore';
import { errorService } from '#/services/errorService';

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

  // No update callback: the response spreads HomeMemberCard_member, so Apollo
  // normalizes by Membership id. A manual `cache.modify` would also run for
  // permission-only toggles, where `role` is undefined — and writing undefined
  // DELETES the field, blanking the card.
  const [updateMembershipMutation] = useMutation(UpdateMembershipDocument);

  const [removeMemberMutation] = useMutation(RemoveMemberDocument, {
    update(cache, { data }, { variables }) {
      if (!appliedPayload(data) || !variables) return;

      try {
        const removeFromMembersCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'membersConnection',
          'Membership',
        );
        removeFromMembersCache(cache, homeId, variables.input.membershipId, {
          evictItem: true,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for removeMember:',
        });
      }
    },
  });

  const [revokeInviteMutation] = useMutation(DeleteHomeInviteDocument, {
    update(cache, { data }, { variables }) {
      if (!appliedPayload(data) || !variables) return;

      try {
        const removeFromInvitesCache = createRemoveFromParentConnectionUpdater(
          'Home',
          'invitesConnection',
          'HomeInvite',
        );
        removeFromInvitesCache(cache, homeId, variables.input.id, {
          evictItem: true,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for revokeInvite:',
        });
      }
    },
  });

  const { markAsDefault } = useMarkHomeAsDefault();

  const [leaveHomeMutation, { loading: leaving, client: leaveClient }] =
    useMutation(LeaveHomeDocument, {
      update(cache, { data }) {
        if (!appliedPayload(data)) return;

        try {
          safeEvict(cache, 'Home', homeId);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for leaveHome:',
          });
        }
      },
      onCompleted: data => {
        if (!appliedPayload(data) || homeId !== selectedHomeId) return;

        // Read remaining homes from cache
        const cachedData = leaveClient.cache.readQuery({
          query: GetHomesDocument,
        });
        const remainingHomes = extractNodes(cachedData?.homes);

        const [newDefaultHome] = remainingHomes;
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
      },
    });

  // Preserve the last good data, since `errorPolicy: 'ignore'` yields undefined
  // on error, then unmask. `useFragment` reads from `{ __typename, id }` rather
  // than the masked ref so it resolves by key; on `!complete` we fall back to
  // null and show the loader, because partial data would render an owner as a
  // non-owner while `myMembership.role` is still absent.
  const homeRef = usePreservedQueryData(data?.home, null);
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

    await settleMutation(
      () =>
        updateMembershipMutation({
          variables: {
            input: { id: membershipId, role: value },
          },
        }),
      {
        document: UpdateMembershipDocument,
        fallback: t('errors.updateMemberRoleFailed'),
      },
    );
  };

  // Toggle a single membership permission override. updateMembership returns the
  // updated member (HomeMemberCard_member), so Apollo normalizes it and the
  // toggle reflects the server state.
  const updateMemberPermission = async (
    membershipId: string,
    permission: MembershipPermissionKey,
    value: boolean,
  ) => {
    const settled = await settleMutation(
      () =>
        updateMembershipMutation({
          variables: { input: { id: membershipId, [permission]: value } },
        }),
      {
        document: UpdateMembershipDocument,
        fallback: t('errors.updateMemberRoleFailed'),
      },
    );
    return settled.status !== 'failed';
  };

  // Not `createRemoveOperation`: it sends `{ id }`, and this input's key is
  // `membershipId`.
  const removeMember = (membershipId: string, memberName: string) =>
    new Promise<boolean>(resolve => {
      alertService.alert(
        t('confirmations.removeMemberTitle'),
        t('confirmations.removeMemberNamed', { name: memberName }),
        [
          {
            text: t('labels.cancel'),
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: t('labels.remove'),
            style: 'destructive',
            onPress: () => {
              void settleMutation(
                () =>
                  removeMemberMutation({
                    variables: { input: { membershipId } },
                  }),
                {
                  document: RemoveMemberDocument,
                  fallback: t('errors.removeMemberFailed'),
                  removal: true,
                  onConflictRefresh: () => {
                    void refetch();
                  },
                },
              ).then(settled => resolve(settled.status !== 'failed'));
            },
          },
        ],
      );
    });

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

  const leaveHome = (homeName: string): Promise<boolean> => {
    return new Promise(resolve => {
      alertService.alert(
        t('labels.leaveHome'),
        t('home.leaveBody', { name: homeName }),
        [
          {
            text: t('labels.cancel'),
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: t('labels.leave'),
            style: 'destructive',
            onPress: () => {
              void settleMutation(
                () => leaveHomeMutation({ variables: { input: { homeId } } }),
                {
                  document: LeaveHomeDocument,
                  fallback: t('errors.codes.genericRetry'),
                },
              ).then(settled => resolve(settled.status !== 'failed'));
            },
          },
        ],
      );
    });
  };

  const toggleJoinCode = async (enabled: boolean) => {
    // Only minting a join link is gated; revoking one stays available so an
    // unverified account can always close off a home it already opened.
    if (enabled && !requireVerifiedEmail()) return;

    if (enabled) {
      // Dedicated mutation: mints a joinCode + join link server-side.
      await settleMutation(
        () => enableJoinLinkMutation({ variables: { input: { id: homeId } } }),
        {
          document: EnableHomeJoinLinkDocument,
          fallback: t('errors.updateHomeFailed'),
        },
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
    const settled = await settleMutation(
      () =>
        transferOwnershipMutation({
          variables: { input: { homeId, newOwnerId } },
        }),
      {
        document: TransferHomeOwnershipDocument,
        fallback: t('errors.updateHomeFailed'),
      },
    );
    transferInFlight.current = false;
    return settled.status !== 'failed';
  };

  // Rotate the join code to invalidate a leaked link.
  const rotateJoinCode = async () => {
    const settled = await settleMutation(
      () => rotateJoinCodeMutation({ variables: { input: { id: homeId } } }),
      {
        document: UpdateHomeJoinCodeDocument,
        fallback: t('errors.updateHomeFailed'),
      },
    );
    return settled.status !== 'failed';
  };

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
