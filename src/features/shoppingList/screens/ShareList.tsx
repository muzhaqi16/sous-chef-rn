import React, { useState, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import {
  Pressable,
  WhiteActivityIndicator,
  ThemedRefreshControl,
} from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { useTranslation } from 'react-i18next';
import { EmailInput } from '#components/atoms/EmailInput';
import { useNavigation } from '@react-navigation/native';
import { Header } from '#components/molecules/Header';
import { LoadingInline } from '#components/base/Loading';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useMutation } from '@apollo/client/react';
import {
  RemoveCollaboratorDocument,
  AddCollaboratorDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { CollaboratorRole } from '#/graphql/generated/schemaTypes';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import {
  useLeaveShoppingList,
  removeCollaboratorFromShoppingListCache,
} from '#features/shoppingList/hooks/useLeaveShoppingList';
import { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import CollaboratorPermissionsBottomSheet, {
  CollaboratorPermissionsBottomSheetRef,
} from '#/components/organisms/CollaboratorPermissionsBottomSheet';
import { useUser } from '#store/useAppStore';
import { Button } from '#components/base/Button';
import { OfflineGate } from '#components/atoms/OfflineGate';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import {
  executeMutation,
  executeWithLoadingState,
  unwrapPayload,
} from '#/utils/compilerSafeWrappers';
import { ROLE_PERMISSIONS, INVITE_ROLES } from '#/constants/collaboratorRoles';
import { ChipScrollRow } from '#components/atoms/ChipScrollRow';
import { CollaboratorMemberCard } from '#features/shoppingList/components/CollaboratorMemberCard';
import { ShareCodeSection } from '#features/shoppingList/components/ShareCodeSection';

const addCollaboratorToCache = createAddToParentConnectionUpdater(
  'ShoppingList',
  'collaboratorsConnection',
  'ShoppingListCollaborator',
);

const ROLE_LABEL_KEYS: Record<CollaboratorRole, string> = {
  [CollaboratorRole.Viewer]: 'collaboratorRoles.viewer',
  [CollaboratorRole.Shopper]: 'collaboratorRoles.shopper',
  [CollaboratorRole.Contributor]: 'collaboratorRoles.contributor',
  [CollaboratorRole.Editor]: 'collaboratorRoles.editor',
  [CollaboratorRole.Admin]: 'collaboratorRoles.admin',
  [CollaboratorRole.Owner]: 'collaboratorRoles.owner',
};

type T = (key: string, opts?: Record<string, unknown>) => string;

const buildRoleOptions = (t: T) =>
  INVITE_ROLES.map(role => ({
    key: role,
    icon: ROLE_PERMISSIONS[role].icon,
    label: t(ROLE_LABEL_KEYS[role]),
  }));

export const ShareList: React.FC<StaticScreenProps<{ listId: string }>> = ({
  route,
}) => {
  const { t } = useTranslation();
  const roleOptions = buildRoleOptions(t);
  const { goBack } = useNavigation();
  const { toHomeDetail } = useAppNavigation();
  const { listId } = route.params;

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<CollaboratorRole>(
    CollaboratorRole.Contributor,
  );
  const [sharing, setSharing] = useState(false);
  const permissionsBottomSheetRef =
    useRef<CollaboratorPermissionsBottomSheetRef>(null);

  // Get current user to check if they are owner
  const currentUser = useUser();

  const {
    shoppingList,
    loading,
    isRefetching,
    collaborators,
    name: listName,
    refetch,
  } = useShoppingListDetails(listId);

  const isHomeLinked = !!shoppingList?.homeId;

  const [shareList] = useMutation(AddCollaboratorDocument);
  const [removeMember] = useMutation(RemoveCollaboratorDocument);
  const { leaveList, leaving } = useLeaveShoppingList(listId);

  // `collaborators` from useShoppingListDetails are already materialized
  // ShoppingListCollaboratorFragments (with invitedAt) and null-filtered.

  // Check if current user is owner
  const currentUserCollaborator = collaborators.find(
    c => c.email === currentUser?.email || c.collaboratorId === currentUser?.id,
  );
  const isOwner = currentUserCollaborator?.role === CollaboratorRole.Owner;

  const activeCollaborators = collaborators.filter(c =>
    ['ACCEPTED', 'ACTIVE', 'PENDING'].includes(c.status?.toUpperCase()),
  );

  const isPublic = !!shoppingList?.isPublic;
  const shareCode = shoppingList?.shareCode;

  const handleShare = () => {
    if (!email.trim()) {
      alertService.alert(
        t('labels.error'),
        t('shoppingListScreens.pleaseEnterEmail'),
      );
      return;
    }

    executeWithLoadingState(
      async () => {
        const { data } = await shareList({
          variables: {
            input: {
              shoppingListId: listId,
              email: email.trim(),
              role: selectedRole,
            },
          },
          update(cache, { data: updateData }) {
            const invitePayload = updateData?.inviteToShoppingList;
            if (invitePayload?.__typename === 'InviteToShoppingListPayload') {
              addCollaboratorToCache(
                cache,
                listId,
                invitePayload.collaborator,
                {
                  position: 'end',
                },
              );
            }
          },
        });
        unwrapPayload(
          data?.inviteToShoppingList,
          'InviteToShoppingListPayload',
          t('shoppingListScreens.failedToSendInvitation'),
        );
        setEmail('');
        // No refetch needed: the update() callback above already inserts the
        // new collaborator into the cached collaboratorsConnection.
      },
      setSharing,
      error => {
        alertService.alert(
          t('labels.error'),
          error instanceof Error
            ? error.message
            : t('shoppingListScreens.failedToSendInvitation'),
        );
      },
    );
  };

  const handleRemoveMember = (memberId: string) => {
    alertService.alert(
      t('shoppingListScreens.removeMemberTitle'),
      t('shoppingListScreens.removeMemberMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.remove'),
          style: 'destructive',
          // No refetch needed: the update() callback removes the collaborator
          // from the cached connection in place.
          onPress: () =>
            executeMutation(
              () =>
                removeMember({
                  variables: { input: { id: memberId } },
                  update(cache) {
                    removeCollaboratorFromShoppingListCache(
                      cache,
                      listId,
                      memberId,
                      { evictItem: true },
                    );
                  },
                }),
              () =>
                alertService.alert(
                  t('labels.error'),
                  t('shoppingListScreens.failedToRemoveMember'),
                ),
            ),
        },
      ],
    );
  };

  const handleLeaveList = () => {
    // Block owners from leaving
    if (isOwner) {
      alertService.alert(
        t('shoppingListScreens.cannotLeaveTitle'),
        t('shoppingListScreens.cannotLeaveOwnerMessage'),
        [{ text: t('storageLocations.ok') }],
      );
      return;
    }

    alertService.alert(
      t('shoppingListScreens.leaveListTitle'),
      t('shoppingListScreens.leaveListMessage', {
        name: listName || t('shoppingListScreens.thisList'),
      }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('shoppingListScreens.leaveList'),
          style: 'destructive',
          onPress: () => {
            if (!currentUserCollaborator?.id) {
              alertService.alert(
                t('labels.error'),
                t('shoppingListScreens.couldNotDetermineMembership'),
              );
              return;
            }

            leaveList(currentUserCollaborator.id, {
              onSuccess: goBack,
              onError: () =>
                alertService.alert(
                  t('labels.error'),
                  t('shoppingListScreens.failedToLeave'),
                ),
            });
          },
        },
      ],
    );
  };

  // Only block the UI on the initial cold load. usePreservedQueryData keeps
  // shoppingList truthy across refetches, so this avoids the full-screen flash
  // every time a mutation triggers a refetch.
  if (loading && !shoppingList) {
    return <LoadingInline />;
  }

  return (
    <View style={styles.container}>
      <Header
        title={t('shoppingListScreens.shareTitle')}
        onBack={() => goBack()}
        centerTitle
      />

      <OfflineGate
        message={t('shoppingListScreens.sharingOfflineMessage')}
        description={t('shoppingListScreens.sharingOfflineDescription')}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <ThemedRefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
            />
          }
        >
          {isHomeLinked ? (
            <View style={styles.homeLinkedSection}>
              <AlertBanner
                title={t('shoppingListScreens.shareHomeLinkedNotice', {
                  name:
                    shoppingList?.home?.name ??
                    t('shoppingListScreens.ownerUnknown'),
                })}
                icon="home-outline"
                iconLibrary="Ionicons"
                variant="warning"
              />
              <View style={styles.homeLinkedButtonWrapper}>
                <Button
                  title={t('shoppingListScreens.manageHome')}
                  onPress={() =>
                    toHomeDetail({
                      homeId: shoppingList?.homeId ?? '',
                    })
                  }
                  variant="secondary"
                  icon="people-outline"
                />
              </View>
            </View>
          ) : (
            <>
              <ShareCodeSection
                listId={listId}
                isPublic={isPublic}
                shareCode={shareCode}
              />

              <View style={styles.inviteSection}>
                <Text style={styles.sectionTitle}>
                  {t('shoppingListScreens.inviteMembers')}
                </Text>
                <View style={styles.inputRow}>
                  <EmailInput
                    containerStyle={styles.emailInputContainer}
                    value={email}
                    onChangeText={setEmail}
                  />
                  <Pressable
                    style={({ pressed }) => [
                      styles.sendButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleShare}
                    disabled={sharing}
                  >
                    {sharing ? (
                      <WhiteActivityIndicator size="small" />
                    ) : (
                      <Icon name="send" size={20} tone="white" />
                    )}
                  </Pressable>
                </View>
                <Text style={styles.roleLabel}>
                  {t('shoppingListScreens.role')}
                </Text>
                <ChipScrollRow
                  options={roleOptions}
                  selected={selectedRole}
                  onSelect={setSelectedRole}
                  size="md"
                  style={styles.chipScroll}
                  contentContainerStyle={styles.chipRowContent}
                />
              </View>
            </>
          )}

          {activeCollaborators.length > 0 && (
            <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>
                {t('shoppingListScreens.currentMembers')}
              </Text>
              {activeCollaborators.map(member => (
                <CollaboratorMemberCard
                  key={member.id}
                  member={member}
                  currentUserId={currentUser?.id}
                  isHomeLinked={isHomeLinked}
                  onPress={() =>
                    permissionsBottomSheetRef.current?.open(member)
                  }
                  onRemove={() => handleRemoveMember(member.id)}
                />
              ))}
            </View>
          )}

          {/* Leave List section - only show for non-owners who are collaborators on non-home-linked lists */}
          {!!currentUserCollaborator && !isOwner && !isHomeLinked && (
            <View style={styles.leaveSection}>
              <Text style={styles.sectionTitle}>
                {t('shoppingListScreens.dangerZone')}
              </Text>
              <Text style={styles.leaveDescription}>
                {t('shoppingListScreens.leaveDescription')}
              </Text>
              <Button
                title={t('shoppingListScreens.leaveList')}
                onPress={handleLeaveList}
                variant="danger"
                loading={leaving}
                disabled={leaving}
              />
            </View>
          )}
        </ScrollView>

        <CollaboratorPermissionsBottomSheet
          ref={permissionsBottomSheetRef}
          shoppingListId={listId}
          onSuccess={refetch}
        />
      </OfflineGate>
    </View>
  );
};
const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  homeLinkedSection: {
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  homeLinkedButtonWrapper: {
    paddingHorizontal: theme.spacing.md,
  },
  inviteSection: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing['3'],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailInputContainer: {
    flex: 1,
  },
  sendButton: {
    marginLeft: theme.spacing['3'],
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: theme.radii.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  chipScroll: {
    marginHorizontal: -theme.spacing.md,
  },
  chipRowContent: {
    paddingHorizontal: theme.spacing.md,
  },
  membersSection: {
    padding: theme.spacing.md,
  },
  leaveSection: {
    padding: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginTop: 'auto',
    gap: theme.spacing.md,
  },
  leaveDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
