import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Icon } from '#utils/iconUtils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { ScreenHeader } from '#components/molecules/ScreenHeader';
import { InfoRow } from '#components/molecules/InfoRow';
import { useShoppingListDetails } from '#hooks/shoppingList/useShoppingListDetails';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useLazyHomeData } from '#/hooks/home/useLazyHomeData';
import { useShoppingListsQuery } from '#hooks/shoppingList/useShoppingListsQuery';
import { ModalPicker } from '#components/molecules/ModalPicker';
import {
  useUpdateShoppingListMutation,
  useDeleteShoppingListMutation,
  useCreateShoppingListMutation,
  useRemoveCollaboratorMutation,
} from '#generated';
import {
  createRemoveFromQueryConnectionUpdater,
  createAddToQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { useAppStore } from '#store/useAppStore';
import { useErrorService } from '#/services/errorService';
import { useAuthUser } from '#/hooks/auth/useAuthUser';
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
  const { theme } = useUnistyles();
  const listId = route.params?.listId;
  const { navigate, goBack } = useAppNavigation();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );
  const { handleApolloError } = useErrorService();

  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [showHomePicker, setShowHomePicker] = useState(false);

  const { shoppingList, isShared, collaborators } =
    useShoppingListDetails(listId);
  const user = useAuthUser();
  // Use lazy loading for homes data to avoid triggering Zustand store updates
  // that would cause ShoppingListMain to re-render
  const { homes, fetchHomeData, isLoaded: homesLoaded } = useLazyHomeData();

  // Get lists for finding default list after delete
  const { lists } = useShoppingListsQuery();

  // Check if current user is the owner
  const isOwner =
    listId && shoppingList ? isShoppingListOwner(shoppingList, user?.id) : true; // For new lists, user is always the owner
  const role = shoppingList
    ? getShoppingListRole(
        shoppingList,
        user?.id,
        shoppingList.home?.myMembership,
      )
    : null;
  const roleDisplay = formatRoleDisplay(role);
  const ownerInfo = shoppingList
    ? getShoppingListOwnerInfo(shoppingList)
    : null;

  // Find current user's collaborator entry for leave functionality
  const currentUserCollaborator = collaborators.find(
    c => c.email === user?.email || c.collaboratorId === user?.id,
  );
  const isHomeLinked = !!shoppingList?.homeId;

  const [removeMember] = useRemoveCollaboratorMutation();
  const [updateList] = useUpdateShoppingListMutation();
  const [deleteList] = useDeleteShoppingListMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Delete Shopping List',
      });
      toastService.error(message);
    },
    update: (cache, { data }, { variables }) => {
      if (!data?.deleteShoppingList?.shoppingList || !variables) return;

      try {
        const removeFromShoppingListsCache =
          createRemoveFromQueryConnectionUpdater(
            'shoppingLists',
            'ShoppingList',
          );
        removeFromShoppingListsCache(cache, variables.id, { evictItem: true });
      } catch (error) {
        console.warn('Cache update failed for deleteList:', error);
      }
    },
  });
  const addToShoppingListsCache = createAddToQueryConnectionUpdater(
    'shoppingLists',
    'ShoppingList',
  );

  const [createList] = useCreateShoppingListMutation({
    errorPolicy: 'all',
    update(cache, { data }) {
      const newList = data?.createShoppingList?.shoppingList;
      if (newList) {
        addToShoppingListsCache(cache, newList);
      }
    },
    onCompleted: data => {
      const newList = data?.createShoppingList?.shoppingList;
      if (newList) {
        setSelectedShoppingListId(newList.id);
        goBack();
      }
    },
    onError: () => {
      toastService.error('Failed to create list');
    },
  });

  useEffect(() => {
    syncListFormState(shoppingList, listId, setName, setIsDefault);
  }, [shoppingList, listId]);

  const handleSave = () => {
    if (!name.trim()) {
      toastService.error('List name cannot be empty');
      return;
    }

    executeWithLoadingState(
      async () => {
        if (!listId) {
          // Create new list
          await createList({
            variables: {
              input: {
                name: name.trim(),
                description: 'Created from list settings',
                isDefault,
                tags: ['user-created'],
                homeId: selectedHomeId || undefined,
              },
            },
          });
        } else {
          // Update existing list
          await updateList({
            variables: {
              id: listId!,
              input: { name: name.trim(), isDefault },
            },
          });
        }
      },
      setSaving,
      () => {
        toastService.error(
          listId ? 'Failed to save settings' : 'Failed to create list',
        );
      },
    );
  };

  const handleDelete = () => {
    if (!listId) return; // Should never happen as delete button is hidden
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this list? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Register parent deletion to prevent subscription race conditions
            // 10s auto-cleanup timeout in service handles unregistration
            subscriptionService.registerParentDeletion(listId);

            executeMutation(
              async () => {
                await deleteList({ variables: { id: listId! } });

                // Find next list to select (default list from remaining lists)
                const remainingLists = lists.filter(l => l.id !== listId);
                const defaultList = remainingLists.find(l => l.isDefault);

                // Set default list if found, otherwise null to trigger auto-select
                const nextListId = defaultList?.id || null;
                setSelectedShoppingListId(nextListId);
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
    Alert.alert(
      'Leave Shopping List',
      `Are you sure you want to leave "${
        name || 'this list'
      }"? You will lose access to all shared items.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            if (!currentUserCollaborator?.id) {
              toastService.error('Could not determine your membership');
              return;
            }

            executeWithLoadingState(
              async () => {
                await removeMember({
                  variables: { id: currentUserCollaborator.id },
                });
                setSelectedShoppingListId(null);
                goBack();
              },
              setLeaving,
              () => {
                toastService.error('Failed to leave list');
              },
            );
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={
          !listId ? 'Create New List' : isOwner ? 'List Settings' : 'List Info'
        }
        onBack={goBack}
        rightElement={
          isOwner ? (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.saveButton}>
                {saving ? 'Saving...' : !listId ? 'Create' : 'Save'}
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
                List Information
              </Text>

              <InfoRow label="List Name" value={name} />

              <InfoRow label="Your Role" value={roleDisplay} />

              {!!ownerInfo && (
                <InfoRow
                  label="Owner"
                  value={ownerInfo.displayName || ownerInfo.email || 'Unknown'}
                />
              )}

              {!!isShared && (
                <InfoRow
                  label="Shared With"
                  value={`${collaborators.length} members`}
                />
              )}
            </View>

            {/* Leave List section for non-owner collaborators */}
            <View style={commonStyles.settingsSection}>
              <Text style={commonStyles.settingsSectionTitle}>Leave List</Text>

              {isHomeLinked ? (
                <>
                  <View style={[styles.deleteButton, styles.disabledButton]}>
                    <Icon
                      name="log-out-outline"
                      size={20}
                      color={theme.colors.textSecondary}
                    />
                    <Text style={styles.disabledButtonText}>Leave List</Text>
                  </View>
                  <Text style={styles.leaveDescription}>
                    This list is linked to the home "{shoppingList?.home?.name}
                    ". To leave this list, you must leave the home first.
                  </Text>
                </>
              ) : (
                <>
                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={handleLeaveList}
                    disabled={leaving}
                  >
                    <Icon
                      name="log-out-outline"
                      size={20}
                      color={theme.colors.error}
                    />
                    <Text style={styles.deleteButtonText}>
                      {leaving ? 'Leaving...' : 'Leave List'}
                    </Text>
                  </Pressable>
                  <Text style={styles.leaveDescription}>
                    Leaving this list will remove your access to all shared
                    items.
                  </Text>
                </>
              )}
            </View>
          </>
        ) : (
          // Editable view for owners
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>General</Text>

            <View style={commonStyles.settingsInputGroup}>
              <Text style={commonStyles.settingsLabel}>List Name</Text>
              <TextInput
                style={commonStyles.settingsInput}
                value={name}
                onChangeText={setName}
                placeholder="Enter list name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Home selector - only show for new lists */}
            {!listId && (
              <View style={commonStyles.settingsInputGroup}>
                <Text style={commonStyles.settingsLabel}>
                  Link to Home (Optional)
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleOpenHomePicker}
                >
                  <Text style={styles.pickerText}>
                    {homes?.find(h => h.id === selectedHomeId)?.name ||
                      'Personal (No Home)'}
                  </Text>
                  <Icon
                    name="chevron-down"
                    size={20}
                    color={theme.colors.textSecondary}
                  />
                </Pressable>
              </View>
            )}

            <View style={commonStyles.settingsRow}>
              <View style={commonStyles.settingsRowInfo}>
                <Text style={commonStyles.settingsRowLabel}>Default List</Text>
                <Text style={commonStyles.settingsRowDescription}>
                  Make this your default shopping list
                </Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ true: theme.colors.primary }}
              />
            </View>
          </View>
        )}

        {/* Only show sharing section if editing existing list and user is owner */}
        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>Sharing</Text>

            <Pressable
              style={({ pressed }) => [
                styles.actionRow,
                pressed && styles.pressed,
              ]}
              onPress={() => navigate('ShareList', { listId: listId! })}
            >
              <Icon name="person-add" size={20} color={theme.colors.primary} />
              <Text style={styles.actionText}>Manage Members</Text>
              <Icon
                name="chevron-forward"
                size={20}
                color={theme.colors.textSecondary}
              />
            </Pressable>

            {!!isShared && (
              <Text style={styles.sharedInfo}>
                This list is shared with {collaborators.length} members
              </Text>
            )}
          </View>
        )}

        {/* Only show danger zone if editing existing list and user is owner */}
        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>Danger Zone</Text>

            <Pressable
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.pressed,
              ]}
              onPress={handleDelete}
            >
              <Icon name="trash-outline" size={20} color={theme.colors.error} />
              <Text style={styles.deleteButtonText}>Delete List</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Home picker modal */}
      <ModalPicker
        visible={showHomePicker}
        label="Select Home"
        options={[
          { label: 'Personal (No Home)', value: '' },
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
  saveButton: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
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
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.primary,
    marginLeft: theme.spacing['3'],
  },
  sharedInfo: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
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
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.error,
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
  pickerText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
  },
  leaveDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  disabledButton: {
    borderColor: theme.colors.border,
    opacity: 0.6,
  },
  disabledButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
