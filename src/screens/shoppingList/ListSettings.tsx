import React, { useState, useEffect, useCallback } from 'react';
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
import { useShoppingListDetails } from '#hooks/shoppingList/useShoppingListDetails';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useLazyHomeData } from '#/hooks/home/useLazyHomeData';
import { useShoppingListsQuery } from '#hooks/shoppingList/useShoppingListsQuery';
import { ModalPicker } from '#components/molecules/ModalPicker';
import {
  useUpdateShoppingListMutation,
  useDeleteShoppingListMutation,
  useCreateShoppingListMutation,
} from '#generated';
import {
  createRemoveFromQueryConnectionUpdater,
  createAddToQueryConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { useAppStore } from '#store/useAppStore';
import { useErrorService } from '#/services/errorService';
import { useAuth } from '#/hooks/auth/useAuth';
import { toastService } from '#/services/toastService';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  isShoppingListOwner,
  getShoppingListRole,
  formatRoleDisplay,
  getShoppingListOwnerInfo,
} from '#utils/ownershipHelpers';

import type { StaticScreenProps } from '@react-navigation/native';

export const ListSettings: React.FC<StaticScreenProps<{
  listId?: string;
} | undefined>> = ({ route }) => {
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
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [showHomePicker, setShowHomePicker] = useState(false);

  const { shoppingList, isShared, collaborators } =
    useShoppingListDetails(listId);
  const { user } = useAuth();
  // Use lazy loading for homes data to avoid triggering Zustand store updates
  // that would cause ShoppingListMain to re-render
  const { homes, fetchHomeData, isLoaded: homesLoaded } = useLazyHomeData();

  // Get lists for finding default list after delete
  const { lists } = useShoppingListsQuery();

  // Check if current user is the owner
  const isOwner =
    listId && shoppingList ? isShoppingListOwner(shoppingList, user?.id) : true; // For new lists, user is always the owner
  const role = shoppingList
    ? getShoppingListRole(shoppingList, user?.id)
    : null;
  const roleDisplay = formatRoleDisplay(role);
  const ownerInfo = shoppingList
    ? getShoppingListOwnerInfo(shoppingList)
    : null;

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
        const removeFromShoppingListsCache = createRemoveFromQueryConnectionUpdater(
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
    if (shoppingList && listId) {
      setName(shoppingList.name);
      setIsDefault(shoppingList.isDefault);
    } else if (listId) {
      // Set default values for new list
      setName('');
      setIsDefault(false);
    }
  }, [shoppingList, listId]);

  const handleSave = async () => {
    if (!name.trim()) {
      toastService.error('List name cannot be empty');
      return;
    }

    setSaving(true);
    try {
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
    } catch {
      toastService.error(
        listId ? 'Failed to create list' : 'Failed to save settings',
      );
    } finally {
      setSaving(false);
    }
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
          onPress: async () => {
            // Register parent deletion to prevent subscription race conditions
            // 10s auto-cleanup timeout in service handles unregistration
            subscriptionService.registerParentDeletion(listId);

            try {
              await deleteList({ variables: { id: listId! } });

              // Find next list to select (default list from remaining lists)
              const remainingLists = lists.filter(l => l.id !== listId);
              const defaultList = remainingLists.find(l => l.isDefault);

              // Set default list if found, otherwise null to trigger auto-select
              setSelectedShoppingListId(defaultList?.id || null);
              // Use goBack() to pop ListSettings off the stack, unmounting its
              // query watcher so late subscription updates can't trigger a refetch
              goBack();
            } catch {
              // Deletion failed — list wasn't actually deleted, so unregister immediately
              subscriptionService.unregisterParentDeletion(listId);
            }
          },
        },
      ],
    );
  };

  // Lazy-load homes when opening the picker
  const handleOpenHomePicker = useCallback(() => {
    if (!homesLoaded) {
      fetchHomeData();
    }
    setShowHomePicker(true);
  }, [homesLoaded, fetchHomeData]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => goBack()} style={({pressed}) => pressed && styles.pressed}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>
          {!listId
            ? 'Create New List'
            : isOwner
            ? 'List Settings'
            : 'List Info'}
        </Text>
        {!!isOwner && (
          <Pressable onPress={handleSave} disabled={saving} style={({pressed}) => pressed && styles.pressed}>
            <Text style={styles.saveButton}>
              {saving ? 'Saving...' : !listId ? 'Create' : 'Save'}
            </Text>
          </Pressable>
        )}
        {!isOwner && <View style={{ width: 60 }} />}
      </View>

      <ScrollView style={styles.content}>
        {!isOwner && listId ? (
          // Read-only view for collaborators
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>List Information</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>List Name</Text>
              <Text style={styles.infoValue}>{name}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Your Role</Text>
              <View style={styles.roleBadgeContainer}>
                <View style={styles.collaboratorBadge}>
                  <Text style={styles.collaboratorBadgeText}>
                    {roleDisplay}
                  </Text>
                </View>
              </View>
            </View>

            {!!ownerInfo && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner</Text>
                <Text style={styles.infoValue}>
                  {ownerInfo.displayName || ownerInfo.email || 'Unknown'}
                </Text>
              </View>
            )}

            {!!isShared && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Shared With</Text>
                <Text style={styles.infoValue}>
                  {collaborators.length} members
                </Text>
              </View>
            )}
          </View>
        ) : (
          // Editable view for owners
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>General</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>List Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter list name"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>

            {/* Home selector - only show for new lists */}
            {!listId && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Link to Home (Optional)</Text>
                <Pressable
                  style={({pressed}) => [styles.pickerButton, pressed && styles.pressed]}
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

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Default List</Text>
                <Text style={styles.settingDescription}>
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sharing</Text>

            <Pressable
              style={({pressed}) => [styles.actionRow, pressed && styles.pressed]}
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>

            <Pressable
              style={({pressed}) => [styles.deleteButton, pressed && styles.pressed]}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  saveButton: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.sm + 2,
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing['3'],
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing['3'],
  },
  settingLabel: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  settingDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
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
  // Read-only view styles for collaborators
  infoRow: {
    paddingVertical: theme.spacing['3'],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs + 2,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  roleBadgeContainer: {
    flexDirection: 'row',
    marginTop: theme.spacing.xs,
  },
  collaboratorBadge: {
    paddingHorizontal: theme.spacing['3'],
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radii.xs + 2,
    backgroundColor: theme.colors.border,
  },
  collaboratorBadgeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
