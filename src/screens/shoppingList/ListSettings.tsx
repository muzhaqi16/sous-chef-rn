import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Icon } from '#utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useShoppingListDetails, useAppNavigation, useHomeManagement } from '#/hooks';
import { useShoppingListsQuery } from '#hooks/shoppingList';
import { ModalPicker } from '#components/molecules/ModalPicker';
import {
  useUpdateShoppingListMutation,
  useDeleteShoppingListMutation,
  useCreateShoppingListMutation,
  GetShoppingListsLiteDocument,
  ShoppingList,
} from '#generated';
import { createRemoveFromQueryFieldUpdater } from '#/apollo/utils';
import { useAppStore } from '#store/useAppStore';
import { useErrorHandler } from '#/utils/errorHandling';
import { useAuth } from '#/hooks/auth/useAuth';
import { toastService } from '#/services/toastService';
import {
  isShoppingListOwner,
  getShoppingListRole,
  formatRoleDisplay,
  getShoppingListOwnerInfo,
} from '#utils/ownershipHelpers';

import { ShoppingListStackParamList } from '#navigation/stacks/ShoppingListStack';

export const ListSettings: React.FC<{
  route: { params?: ShoppingListStackParamList['ListSettings'] };
}> = ({ route }) => {
  const { theme } = useUnistyles();
  const listId = route.params?.listId;
  const { navigate, goBack, navigateTo } = useAppNavigation();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );
  const { handleApolloError } = useErrorHandler();

  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [showHomePicker, setShowHomePicker] = useState(false);

  const { shoppingList, isShared, collaborators } =
    useShoppingListDetails(listId);
  const { user } = useAuth();
  const { homes } = useHomeManagement();

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
      if (!data?.deleteShoppingList || !variables) return;

      try {
        const removeFromShoppingListsCache = createRemoveFromQueryFieldUpdater(
          'shoppingLists',
          'ShoppingList',
        );
        removeFromShoppingListsCache(cache, variables.id, { evictItem: true });
      } catch (error) {
        console.warn('Cache update failed for deleteList:', error);
      }
    },
  });
  const [createList] = useCreateShoppingListMutation({
    errorPolicy: 'all',
    // TODO: Add optimistic response with all required fields (description, tags, totalItems, etc.)
    // See ShoppingList fragment for complete type definition
    // Update the cache when a new list is created
    update(cache, { data }) {
      if (data?.createShoppingList) {
        try {
          // Read with empty variables (shopping lists are independent of homes)
          const existingData = cache.readQuery<{
            shoppingLists: ShoppingList[];
          }>({
            query: GetShoppingListsLiteDocument,
            variables: {},
          });

          if (existingData) {
            // Write with same empty variables to update the cache
            cache.writeQuery({
              query: GetShoppingListsLiteDocument,
              variables: {},
              data: {
                ...existingData,
                shoppingLists: [
                  ...(existingData.shoppingLists || []),
                  data.createShoppingList,
                ],
              },
            });
          }
        } catch (error) {
          console.log(
            'Cache update failed during shopping list create:',
            error,
          );
        }
      }
    },
    onCompleted: data => {
      if (data?.createShoppingList) {
        // Always set the new list as selected
        setSelectedShoppingListId(data.createShoppingList.id);
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
    } catch (error) {
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
            await deleteList({ variables: { id: listId! } });

            // Find next list to select (default list from remaining lists)
            const remainingLists = lists.filter(l => l.id !== listId);
            const defaultList = remainingLists.find(l => l.isDefault);

            // Set default list if found, otherwise null to trigger auto-select
            setSelectedShoppingListId(defaultList?.id || null);
            navigateTo.shoppingListMain();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {!listId
            ? 'Create New List'
            : isOwner
            ? 'List Settings'
            : 'List Info'}
        </Text>
        {isOwner && (
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={styles.saveButton}>
              {saving ? 'Saving...' : !listId ? 'Create' : 'Save'}
            </Text>
          </TouchableOpacity>
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

            {ownerInfo && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Owner</Text>
                <Text style={styles.infoValue}>
                  {ownerInfo.displayName || ownerInfo.email || 'Unknown'}
                </Text>
              </View>
            )}

            {isShared && (
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
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowHomePicker(true)}
                >
                  <Text style={styles.pickerText}>
                    {homes?.find(h => h.id === selectedHomeId)?.name || 'Personal (No Home)'}
                  </Text>
                  <Icon library="Feather" name="chevron-down" size={20} color={theme.colors.textSecondary} />
                </TouchableOpacity>
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
        {listId && isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sharing</Text>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => navigate('ShareList', { listId: listId! })}
            >
              <Icon name="person-add" size={20} color={theme.colors.primary} />
              <Text style={styles.actionText}>Manage Members</Text>
              <Icon
                name="chevron-right"
                size={20}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>

            {isShared && (
              <Text style={styles.sharedInfo}>
                This list is shared with {collaborators.length} members
              </Text>
            )}
          </View>
        )}

        {/* Only show danger zone if editing existing list and user is owner */}
        {listId && isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Icon name="delete" size={20} color={theme.colors.error} />
              <Text style={styles.deleteButtonText}>Delete List</Text>
            </TouchableOpacity>
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
        onSelect={(value) => {
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
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  saveButton: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
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
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  inputGroup: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: '500',
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
    fontWeight: '500',
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
    fontWeight: '600',
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
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs + 2,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '500',
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
    fontWeight: '600',
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
}));
