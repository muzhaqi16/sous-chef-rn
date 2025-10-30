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
import { useShoppingListDetails, useAppNavigation } from '#/hooks';
import {
  useUpdateShoppingListMutation,
  useDeleteShoppingListMutation,
  useCreateShoppingListMutation,
  GetShoppingListsDocument,
  ShoppingList,
} from '#generated';
import { useStore } from '#store';
import { useErrorHandler } from '#/utils/errorHandling';
import { useAuth } from '#/hooks/auth/useAuth';
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
  const setSelectedShoppingListId = useStore(state => state.setSelectedShoppingListId);
  const { handleApolloError } = useErrorHandler();

  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const { shoppingList, isShared } = useShoppingListDetails(listId);
  const { user } = useAuth();

  // Check if current user is the owner
  const isOwner = listId && shoppingList
    ? isShoppingListOwner(shoppingList, user?.id)
    : true; // For new lists, user is always the owner
  const role = shoppingList ? getShoppingListRole(shoppingList, user?.id) : null;
  const roleDisplay = formatRoleDisplay(role);
  const ownerInfo = shoppingList ? getShoppingListOwnerInfo(shoppingList) : null;

  const [updateList] = useUpdateShoppingListMutation();
  const [deleteList] = useDeleteShoppingListMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Delete Shopping List',
      });
      Alert.alert('Error', message);
    },
    refetchQueries: ['GetShoppingLists'],
    awaitRefetchQueries: true,
  });
  const [createList] = useCreateShoppingListMutation({
    // Update the cache when a new list is created
    update(cache, { data }) {
      if (data?.createShoppingList) {
        try {
          // Read the existing query from cache
          const existingData = cache.readQuery<{
            shoppingLists: ShoppingList[];
          }>({
            query: GetShoppingListsDocument,
          });

          if (existingData) {
            // Write the updated data back to cache
            cache.writeQuery({
              query: GetShoppingListsDocument,
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
      Alert.alert('Error', 'Failed to create list');
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
      Alert.alert('Error', 'List name cannot be empty');
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
      Alert.alert(
        'Error',
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
            // Clear the selected shopping list ID if we just deleted it
            setSelectedShoppingListId(null);
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
        {!isOwner && <View style={{width: 60}} />}
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
                  <Text style={styles.collaboratorBadgeText}>{roleDisplay}</Text>
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
                  {shoppingList?.collaborators?.length || 0} members
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
                This list is shared with {shoppingList?.collaborators?.length}{' '}
                members
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.primary,
    marginLeft: 12,
  },
  sharedInfo: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.error,
    marginLeft: 8,
  },
  // Read-only view styles for collaborators
  infoRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  roleBadgeContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  collaboratorBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.border || '#E0E0E0',
  },
  collaboratorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
}));
