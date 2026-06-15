import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { useTranslation } from 'react-i18next';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { ScreenHeader } from '#components/molecules/ScreenHeader';
import { InfoRow } from '#components/molecules/InfoRow';
import { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useLazyHomeData } from '#/hooks/home/useLazyHomeData';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { useLeaveShoppingList } from '#features/shoppingList/hooks/useLeaveShoppingList';
import { useUpdateShoppingList } from '#features/shoppingList/hooks/mutations/useUpdateShoppingList';
import { useCreateShoppingList } from '#features/shoppingList/hooks/mutations/useCreateShoppingList';
import { useDeleteShoppingList } from '#features/shoppingList/hooks/mutations/useDeleteShoppingList';
import { useAppStore } from '#store/useAppStore';

import { useUser } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import {
  executeWithLoadingState,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  isShoppingListOwner,
  getShoppingListRole,
  formatRoleDisplay,
  getShoppingListOwnerInfo,
} from '#utils/ownershipHelpers';

import type { StaticScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '#components/atoms/Text';

/** Module-level helper to sync shopping list form state from loaded data */
function syncListFormState(
  shoppingList: { name: string; isDefault: boolean } | null | undefined,
  listId: string | undefined,
  setName: (v: string) => void,
  setIsDefault: (v: boolean) => void,
) {
  if (shoppingList && listId) {
    setName(shoppingList.name);
    setIsDefault(shoppingList.isDefault);
  } else if (listId) {
    setName('');
    setIsDefault(false);
  }
}

export const ListSettings: React.FC<
  StaticScreenProps<
    | {
        listId?: string;
      }
    | undefined
  >
> = ({ route }) => {
  const { t } = useTranslation();
  const listId = route.params?.listId;
  const { toShareList, toHomeDetail, goBack } = useAppNavigation();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [showHomePicker, setShowHomePicker] = useState(false);

  const { shoppingList, isShared, collaborators, ownerships } =
    useShoppingListDetails(listId);
  const user = useUser();
  // Use lazy loading for homes data to avoid triggering Zustand store updates
  // that would cause ShoppingListMain to re-render
  const { homes, fetchHomeData, isLoaded: homesLoaded } = useLazyHomeData();

  // ownerships + collaborators are materialized in the hook so the helpers
  // (typed against structural shapes) accept them via a synthesized arg.
  const ownershipSnapshot = shoppingList
    ? {
        ownerships,
        collaboratorsConnection: {
          edges: collaborators.map(n => ({ node: n })),
        },
      }
    : null;

  // Check if current user is the owner
  const isOwner =
    listId && ownershipSnapshot
      ? isShoppingListOwner(ownershipSnapshot, user?.id)
      : true; // For new lists, user is always the owner
  const role = ownershipSnapshot
    ? getShoppingListRole(
        ownershipSnapshot,
        user?.id,
        shoppingList?.home?.myMembership,
      )
    : null;
  const roleDisplay = formatRoleDisplay(role);
  const ownerInfo = ownershipSnapshot
    ? getShoppingListOwnerInfo(ownershipSnapshot)
    : null;

  // Find current user's collaborator entry for leave functionality
  const currentUserCollaborator = collaborators.find(
    c => c.email === user?.email || c.collaboratorId === user?.id,
  );
  // Only members of the linked home are told to "leave the home first" — that's
  // the only case where list access actually derives from home membership. A
  // direct collaborator who isn't a member of the home (e.g. the list was shared
  // while personal, then later linked to a home) has an orphaned collaborator
  // row and must be able to leave the list directly. Gating on homeId alone
  // dead-ends those users: they can't leave a home they were never in.
  const isHomeMember = !!shoppingList?.home?.myMembership;
  const linkedHomeId = shoppingList?.homeId ?? null;

  const { leaveList, leaving } = useLeaveShoppingList(listId || '');
  const { updateShoppingList } = useUpdateShoppingList(
    t('shoppingListScreens.failedToSave'),
  );
  const { deleteShoppingList } = useDeleteShoppingList();
  const { createShoppingList } = useCreateShoppingList(
    t('shoppingListScreens.failedToCreate'),
  );

  useEffect(() => {
    syncListFormState(shoppingList, listId, setName, setIsDefault);
  }, [shoppingList, listId]);

  // Safe return after leaving the linked home. A non-owner's access to a
  // home-linked list is derived from their home membership — there's no direct
  // collaborator row. Leaving the home from the "Manage Home" screen evicts the
  // Home from cache (see useHomeDetailManagement) but leaves the ShoppingList
  // entity in place, so without this guard the user would land back on a list
  // they can no longer open. When this screen regains focus with the list still
  // loaded but every access path gone (not the owner, no collaborator row, no
  // home membership), pop back to the list index and clear the now-inaccessible
  // selection so ShoppingListMain auto-selects another list.
  const hasLostListAccess =
    !!listId &&
    !!shoppingList &&
    !isOwner &&
    !currentUserCollaborator &&
    !isHomeMember;

  useFocusEffect(() => {
    if (hasLostListAccess) {
      setSelectedShoppingListId(null);
      goBack();
    }
  });

  const handleSave = () => {
    if (!name.trim()) {
      toastService.error(t('shoppingListScreens.listNameEmpty'));
      return;
    }

    executeWithLoadingState(
      async () => {
        if (!listId) {
          // Create new list
          const newList = await createShoppingList({
            name: name.trim(),
            description: t('shoppingListScreens.createdFromSettings'),
            isDefault,
            tags: ['user-created'],
            homeId: selectedHomeId || undefined,
          });
          setSelectedShoppingListId(newList.id);
          goBack();
        } else {
          // Update existing list (local-first: a queued offline save keeps the
          // permanent cache write and replays on reconnect)
          await updateShoppingList(listId!, { name: name.trim(), isDefault });
        }
      },
      setSaving,
      () => {
        toastService.error(
          listId
            ? t('shoppingListScreens.failedToSave')
            : t('shoppingListScreens.failedToCreate'),
        );
      },
    );
  };

  const handleDelete = () => {
    if (!listId) return; // Should never happen as delete button is hidden
    alertService.alert(
      t('shoppingListScreens.deleteListConfirmTitle'),
      t('shoppingListScreens.deleteListConfirmMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.delete'),
          style: 'destructive',
          onPress: () => {
            // Register parent deletion to prevent subscription race conditions
            // 10s auto-cleanup timeout in service handles unregistration
            subscriptionService.registerParentDeletion(listId);

            executeMutation(
              async () => {
                await deleteShoppingList(listId!);

                // Clear selection — useShoppingListSelection auto-selects the next list
                setSelectedShoppingListId(null);
                // Use goBack() to pop ListSettings off the stack, unmounting its
                // query watcher so late subscription updates can't trigger a refetch
                goBack();
              },
              () => {
                // Deletion failed — list wasn't actually deleted, so unregister immediately
                subscriptionService.unregisterParentDeletion(listId);
              },
            );
          },
        },
      ],
    );
  };

  // Lazy-load homes when opening the picker
  const handleOpenHomePicker = () => {
    if (!homesLoaded) {
      fetchHomeData();
    }
    setShowHomePicker(true);
  };

  const handleLeaveList = () => {
    alertService.alert(
      t('shoppingListScreens.leaveListTitle'),
      t('shoppingListScreens.leaveListMessage', {
        name: name || t('shoppingListScreens.thisList'),
      }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('shoppingListScreens.leaveList'),
          style: 'destructive',
          onPress: () => {
            if (!currentUserCollaborator?.id) {
              toastService.error(
                t('shoppingListScreens.couldNotDetermineMembership'),
              );
              return;
            }

            leaveList(currentUserCollaborator.id, {
              onSuccess: () => {
                setSelectedShoppingListId(null);
                goBack();
              },
              onError: () =>
                toastService.error(t('shoppingListScreens.failedToLeave')),
            });
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={
          !listId
            ? t('shoppingListScreens.createNewList')
            : isOwner
            ? t('shoppingListScreens.listSettings')
            : t('shoppingListScreens.listInfo')
        }
        onBack={goBack}
        rightElement={
          isOwner ? (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => pressed && { opacity: 0.7 }}
            >
              <Text size="md" weight="semibold" tone="accent">
                {saving
                  ? t('pantrySettings.saving')
                  : !listId
                  ? t('pantrySettings.create')
                  : t('pantrySettings.save')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView style={styles.content}>
        {!isOwner && listId ? (
          <>
            {/* Read-only view for collaborators */}
            <View style={commonStyles.settingsSection}>
              <Text style={commonStyles.settingsSectionTitle}>
                {t('shoppingListScreens.listInformation')}
              </Text>

              <InfoRow label={t('shoppingListScreens.listName')} value={name} />

              <InfoRow
                label={t('shoppingListScreens.yourRole')}
                value={roleDisplay}
              />

              {!!ownerInfo && (
                <InfoRow
                  label={t('shoppingListScreens.owner')}
                  value={
                    ownerInfo.displayName ||
                    ownerInfo.email ||
                    t('shoppingListScreens.ownerUnknown')
                  }
                />
              )}

              {!!isShared && (
                <InfoRow
                  label={t('shoppingListScreens.sharedWith')}
                  value={t('shoppingListScreens.membersCount', {
                    count: collaborators.length,
                  })}
                />
              )}
            </View>

            {/* Leave List section for non-owner collaborators */}
            <View style={commonStyles.settingsSection}>
              <Text style={commonStyles.settingsSectionTitle}>
                {t('shoppingListScreens.leaveListSection')}
              </Text>

              {isHomeMember ? (
                <>
                  <View style={styles.disabledLeaveButton}>
                    <Icon
                      name="log-out-outline"
                      size={20}
                      tone="textSecondary"
                    />
                    <Text
                      size="md"
                      weight="semibold"
                      tone="secondary"
                      style={styles.disabledButtonText}
                    >
                      {t('shoppingListScreens.leaveList')}
                    </Text>
                  </View>
                  <Text
                    size="sm"
                    tone="secondary"
                    style={styles.leaveDescription}
                  >
                    {t('shoppingListScreens.cantLeaveHomeLinkedMessage', {
                      name: shoppingList?.home?.name ?? '',
                    })}
                  </Text>
                  {!!linkedHomeId && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => toHomeDetail({ homeId: linkedHomeId })}
                    >
                      <Icon name="people-outline" size={20} tone="primary" />
                      <Text size="md" tone="accent" style={styles.actionText}>
                        {t('shoppingListScreens.manageHome')}
                      </Text>
                      <Icon
                        name="chevron-forward"
                        size={20}
                        tone="textSecondary"
                      />
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={handleLeaveList}
                    disabled={leaving}
                  >
                    <Icon name="log-out-outline" size={20} tone="error" />
                    <Text
                      size="md"
                      weight="semibold"
                      tone="error"
                      style={styles.deleteButtonText}
                    >
                      {leaving
                        ? t('shoppingListScreens.leaving')
                        : t('shoppingListScreens.leaveList')}
                    </Text>
                  </Pressable>
                  <Text
                    size="sm"
                    tone="secondary"
                    style={styles.leaveDescription}
                  >
                    {t('shoppingListScreens.leaveDescription')}
                  </Text>
                </>
              )}
            </View>
          </>
        ) : (
          // Editable view for owners
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.general')}
            </Text>

            <BaseInput
              label={t('shoppingListScreens.listName')}
              value={name}
              onChangeText={setName}
              placeholder={t('shoppingListScreens.listNamePlaceholder')}
            />

            {/* Home selector - only show for new lists */}
            {!listId && (
              <View style={commonStyles.settingsInputGroup}>
                <Text style={commonStyles.settingsLabel}>
                  {t('shoppingListScreens.linkToHome')}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={handleOpenHomePicker}
                >
                  <Text size="md">
                    {homes?.find(h => h.id === selectedHomeId)?.name ||
                      t('shoppingListScreens.personalNoHome')}
                  </Text>
                  <Icon name="chevron-down" size={20} tone="textSecondary" />
                </Pressable>
              </View>
            )}

            <View style={commonStyles.settingsRow}>
              <View style={commonStyles.settingsRowInfo}>
                <Text style={commonStyles.settingsRowLabel}>
                  {t('shoppingListScreens.defaultList')}
                </Text>
                <Text style={commonStyles.settingsRowDescription}>
                  {t('shoppingListScreens.defaultListDesc')}
                </Text>
              </View>
              <BaseSwitch value={isDefault} onValueChange={setIsDefault} />
            </View>
          </View>
        )}

        {/* Only show sharing section if editing existing list and user is owner */}
        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.sharing')}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.actionRow,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => toShareList({ listId: listId! })}
            >
              <Icon name="person-add" size={20} tone="primary" />
              <Text size="md" tone="accent" style={styles.actionText}>
                {t('shoppingListScreens.manageMembers')}
              </Text>
              <Icon name="chevron-forward" size={20} tone="textSecondary" />
            </Pressable>

            {!!isShared && (
              <Text size="sm" tone="secondary" style={styles.sharedInfo}>
                {t('shoppingListScreens.sharedWithMembers', {
                  count: collaborators.length,
                })}
              </Text>
            )}
          </View>
        )}

        {/* Only show danger zone if editing existing list and user is owner */}
        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.dangerZone')}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleDelete}
            >
              <Icon name="trash-outline" size={20} tone="error" />
              <Text
                size="md"
                weight="semibold"
                tone="error"
                style={styles.deleteButtonText}
              >
                {t('shoppingListScreens.deleteList')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Home picker modal */}
      <ModalPicker
        visible={showHomePicker}
        label={t('shoppingListScreens.selectHome')}
        options={[
          { label: t('shoppingListScreens.personalNoHome'), value: '' },
          ...(homes?.map(home => ({
            label: home.name,
            value: home.id,
          })) || []),
        ]}
        selected={selectedHomeId || ''}
        onSelect={value => {
          setSelectedHomeId(value || null);
          setShowHomePicker(false);
        }}
        onCancel={() => setShowHomePicker(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
  },
  actionText: {
    flex: 1,
    marginLeft: theme.spacing['3'],
  },
  sharedInfo: {
    marginTop: theme.spacing.sm,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3'],
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.radii.sm,
  },
  deleteButtonText: {
    marginLeft: theme.spacing.sm,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.sm + 2,
    backgroundColor: theme.colors.surface,
  },
  leaveDescription: {
    marginTop: theme.spacing.sm,
  },
  disabledLeaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3'],
    borderWidth: 1,
    borderRadius: theme.radii.sm,
    borderColor: theme.colors.border,
    opacity: 0.6,
  },
  disabledButtonText: {
    marginLeft: theme.spacing.sm,
  },
}));
