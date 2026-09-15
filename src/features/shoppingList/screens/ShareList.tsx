import React, { useRef } from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '#components/atoms/Text';
import { PlainScrollRefreshControl } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';

import { useDataState } from '#hooks/data/useDataState';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useRemoveCollaborator } from '#features/shoppingList/hooks/useRemoveCollaborator';
import { isShoppingListOwner } from '#features/shoppingList/utils/ownershipHelpers';
import { useLeaveShoppingList } from '#features/shoppingList/hooks/useLeaveShoppingList';
import { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import type { CollaboratorPermissionsBottomSheetRef } from '#features/shoppingList/components/CollaboratorPermissionsBottomSheet';
import CollaboratorPermissionsBottomSheet from '#features/shoppingList/components/CollaboratorPermissionsBottomSheet';
import { useUser } from '#store/useAppStore';
import { Button } from '#components/molecules/Button';
import { OfflineGate } from '#features/shoppingList/components/OfflineGate';
import { AlertBanner } from '#components/molecules/AlertBanner';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { CollaboratorMemberCard } from '#features/shoppingList/components/CollaboratorMemberCard';
import { ShareCodeSection } from '#features/shoppingList/components/ShareCodeSection';
import { ShareInviteSection } from '#features/shoppingList/components/ShareInviteSection';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { Screen } from '#components/templates/Screen';
import { CollaboratorStatus } from '#/graphql/generated/schemaTypes';

export const ShareList: React.FC<StaticScreenProps<{ listId: string }>> = ({
  route,
}) => {
  const { t } = useTranslation();
  const { goBack, toHomeDetail } = useAppNavigation();
  const { listId } = route.params;

  const permissionsBottomSheetRef =
    useRef<CollaboratorPermissionsBottomSheetRef>(null);

  // Get current user to check if they are owner
  const currentUser = useUser();

  const {
    shoppingList,
    loading,
    hasResult,
    isRefetching,
    collaborators,
    ownerships,
    name: listName,
    refetch,
  } = useShoppingListDetails(listId);

  const isHomeLinked = !!shoppingList?.homeId;

  const { removeCollaborator } = useRemoveCollaborator(listId);
  const { leaveList, leaving } = useLeaveShoppingList(listId);

  // `collaborators` from useShoppingListDetails are already materialized
  // ShoppingListCollaboratorFragments (with invitedAt) and null-filtered.

  // Ownership is a separate ShoppingListOwnership record, not the collaborator
  // `role` field — the list creator's collaborator row is not necessarily role
  // OWNER. Read ownership from `ownerships` (the same signal ListSettings uses)
  // so both screens agree on who the owner is.
  const isOwner = isShoppingListOwner({ ownerships }, currentUser?.id);
  const ownerUserIds = new Set(ownerships.map(o => o.userId));

  // Still needed for the leave flow, which removes the current user's own
  // collaborator entry by id.
  // The email arm is guarded: both sides are nullable, and a null-to-null
  // comparison would match an arbitrary collaborator as "me".
  const currentUserCollaborator = collaborators.find(
    c =>
      (!!currentUser?.email && c.email === currentUser.email) ||
      c.collaboratorId === currentUser?.id,
  );

  const activeCollaborators = collaborators.filter(
    c =>
      c.status === CollaboratorStatus.Active ||
      c.status === CollaboratorStatus.Pending,
  );

  const isPublic = !!shoppingList?.isPublic;
  const shareCode = shoppingList?.shareCode;

  const handleRemoveMember = (memberId: string) => {
    alertService.alert(
      t('confirmations.removeMemberTitle'),
      t('labels.areYouSureYouWantToRemoveThisMember'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.remove'),
          style: 'destructive',
          // No refetch needed: the hook removes the collaborator from the
          // cached connection in place, and alerts a refusal itself.
          onPress: () => {
            void removeCollaborator(memberId);
          },
        },
      ],
    );
  };

  const handleLeaveList = () => {
    // Block owners from leaving
    if (isOwner) {
      alertService.alert(
        t('labels.cannotLeave'),
        t('shoppingListScreens.cannotLeaveOwnerMessage'),
        [{ text: t('labels.ok') }],
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
          text: t('labels.leaveList'),
          style: 'destructive',
          onPress: () => {
            if (!currentUserCollaborator?.id) {
              alertService.alert(
                t('labels.error'),
                t('shoppingListScreens.couldNotDetermineMembership'),
              );
              return;
            }

            void leaveList(currentUserCollaborator.id, {
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

  const dataState = useDataState({ loading, hasResult, isEmpty: false });

  return (
    <Screen
      header={{
        title: t('shoppingListScreens.shareTitle'),
        back: () => goBack(),
        centerTitle: true,
      }}
      scroll="list"
      gutter="none"
      state={{
        value: dataState,
        onRetry: () => {
          void refetch();
        },
      }}
    >
      <OfflineGate
        message={t('shoppingListScreens.sharingOfflineMessage')}
        description={t('shoppingListScreens.sharingOfflineDescription')}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <PlainScrollRefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
            />
          }
        >
          {isHomeLinked ? (
            <View style={styles.homeLinkedSection}>
              <AlertBanner
                title={t('shoppingListScreens.shareHomeLinkedNotice', {
                  name: shoppingList?.home?.name ?? t('labels.unknown'),
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
                shareLinkUrl={shoppingList?.shareLink?.universal}
              />

              <ShareInviteSection listId={listId} />
            </>
          )}

          {activeCollaborators.length > 0 && (
            <View style={styles.membersSection}>
              <SectionHeader style={styles.sectionTitleSpacing}>
                {t('shoppingListScreens.currentMembers')}
              </SectionHeader>
              {activeCollaborators.map(member => (
                <CollaboratorMemberCard
                  key={member.id}
                  member={member}
                  currentUserId={currentUser?.id}
                  isHomeLinked={isHomeLinked}
                  isOwner={
                    !!member.collaboratorId &&
                    ownerUserIds.has(member.collaboratorId)
                  }
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
              <SectionHeader style={styles.sectionTitleSpacing}>
                {t('labels.dangerZone')}
              </SectionHeader>
              <Text role="caption" style={styles.leaveDescription}>
                {t('shoppingListScreens.leaveDescription')}
              </Text>
              <Button
                title={t('labels.leaveList')}
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
    </Screen>
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
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  homeLinkedButtonWrapper: {
    paddingHorizontal: theme.spacing.md,
  },
  membersSection: {
    padding: theme.spacing.md,
  },
  leaveSection: {
    padding: theme.spacing.md,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
    marginTop: 'auto',
    gap: theme.spacing.md,
  },
  leaveDescription: {
    color: theme.colors.textSecondary,
  },
  sectionTitleSpacing: {
    marginBottom: theme.spacing.base,
  },
}));
