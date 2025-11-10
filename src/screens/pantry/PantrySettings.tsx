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
import { Icon } from '#/utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useGetPantryQuery,
  useUpdatePantryMutation,
  useDeletePantryMutation,
  useCreatePantryMutation,
} from '#generated';
import { useStore } from '#store';
import { useAppNavigation } from '#hooks';
import { PantryStackParamList } from '#navigation/stacks/PantryStack';
import { useErrorHandler } from '#/utils/errorHandling';
import { normalizePantry } from '#/utils/connectionUtils';

export const PantrySettings: React.FC<{
  route: { params?: PantryStackParamList['PantrySettings'] };
}> = ({ route }) => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const pantryId = route.params?.pantryId;

  const { selectedHomeId } = useStore();
  const setSelectedPantryId = useStore(state => state.setSelectedPantryId);
  const { handleApolloError } = useErrorHandler();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Simplified query configuration - let Apollo handle caching naturally
  const {
    data: pantryData,
    loading: loadingPantry,
    error: pantryError,
  } = useGetPantryQuery({
    variables: { id: pantryId ?? '' },
    skip: !pantryId,
  });

  const pantry = normalizePantry(pantryData?.pantry);

  const [updatePantry] = useUpdatePantryMutation({
    // Update cache directly - Apollo automatically merges the Pantry entity
    // No need to update home's pantries array since the pantry is just updated, not added/removed
  });
  const [deletePantry] = useDeletePantryMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Delete Pantry',
      });
      Alert.alert('Error', message);
    },
    // Update cache directly instead of refetching
    update: (cache, { data }, { variables }) => {
      if (!data?.deletePantry || !variables?.id || !selectedHomeId) return;

      try {
        const deletedPantryId = variables.id;

        // Remove pantry from home's pantries array
        const homeCacheId = cache.identify({
          __typename: 'Home',
          id: selectedHomeId,
        });

        if (!homeCacheId) {
          return;
        }

        cache.modify({
          id: homeCacheId,
          fields: {
            pantries(existingPantries = [], { readField }) {
              return existingPantries.filter(
                (pantryRef: any) =>
                  readField('id', pantryRef) !== deletedPantryId,
              );
            },
            pantriesConnection(existingConnection = null, { readField }) {
              if (!existingConnection?.edges) {
                return existingConnection;
              }

              const filteredEdges = existingConnection.edges.filter(
                (edge: any) => readField('id', edge?.node) !== deletedPantryId,
              );

              return {
                ...existingConnection,
                edges: filteredEdges,
                totalCount: Math.max(
                  0,
                  (existingConnection.totalCount ?? filteredEdges.length) -
                    (filteredEdges.length < existingConnection.edges.length ? 1 : 0),
                ),
              };
            },
          },
        });

        // Evict the deleted pantry from cache
        cache.evict({
          id: cache.identify({ __typename: 'Pantry', id: deletedPantryId }),
        });
        cache.gc(); // Garbage collect orphaned data
      } catch (error) {
        console.warn('Cache update failed for deletePantry:', error);
        // Fallback handled by UI refetch
      }
    },
  });

  const [createPantry] = useCreatePantryMutation({
    // Update cache directly instead of refetching
    update: (cache, { data }) => {
      if (!data?.createPantry || !selectedHomeId) return;

      try {
        const newPantry = data.createPantry;

        // Add new pantry to home's pantries array
        const homeCacheId = cache.identify({
          __typename: 'Home',
          id: selectedHomeId,
        });

        if (!homeCacheId) {
          return;
        }

        cache.modify({
          id: homeCacheId,
          fields: {
            pantries(existingPantries = [], { readField, toReference }) {
              const newPantryRef = toReference(newPantry);
              const exists = existingPantries.some(
                (pantryRef: any) => readField('id', pantryRef) === newPantry.id,
              );

              if (exists) {
                return existingPantries;
              }

              return [...existingPantries, newPantryRef];
            },
            pantriesConnection(existingConnection = null) {
              if (!existingConnection) {
                return existingConnection;
              }

              const newEdge = {
                __typename: 'PantryEdge',
                cursor: newPantry.id,
                node: {
                  __typename: 'Pantry',
                  ...newPantry,
                },
              };

              return {
                ...existingConnection,
                edges: [...(existingConnection.edges || []), newEdge],
                totalCount:
                  (existingConnection.totalCount ??
                    (existingConnection.edges?.length || 0)) + 1,
              };
            },
          },
        });
      } catch (error) {
        console.warn('Cache update failed for createPantry:', error);
        // Fallback handled by UI
      }
    },
    onCompleted: data => {
      if (data?.createPantry) {
        // Set the newly created pantry as selected if it's marked as default
        if (isDefault) {
          setSelectedPantryId(data.createPantry.id);
        }
      }
      goBack();
    },
    onError: () => {
      Alert.alert('Error', 'Failed to create pantry');
    },
  });

  useEffect(() => {
    // Handle error case
    if (pantryError && pantryId) {
      console.error('❌ Error loading pantry:', pantryError);
      Alert.alert(
        'Error Loading Pantry',
        'Failed to load pantry data. Please try again.',
      );
      return;
    }

    if (pantry && pantryId) {
      setName(pantry.name || '');
      setDescription(pantry.description || '');
      setIsDefault(pantry.isDefault || false);
    } else if (!pantryId) {
      // Set default values for new pantry
      setName('');
      setDescription('');
      setIsDefault(false);
    }
  }, [pantry, pantryId, pantryError]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Pantry name cannot be empty');
      return;
    }

    if (!selectedHomeId) {
      Alert.alert('Error', 'No home selected');
      return;
    }

    setSaving(true);
    try {
      if (!pantryId) {
        // Create new pantry
        await createPantry({
          variables: {
            input: {
              homeId: selectedHomeId,
              name: name.trim(),
              description: description.trim() || 'User created pantry',
              isDefault,
              tags: ['user-created'],
            },
          },
        });
      } else {
        // Update existing pantry
        await updatePantry({
          variables: {
            id: pantryId,
            input: {
              name: name.trim(),
              description: description.trim(),
              isDefault,
            },
          },
        });
      }
    } catch (error) {
      Alert.alert(
        'Error',
        pantryId ? 'Failed to save settings' : 'Failed to create pantry',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!pantryId) return;

    Alert.alert(
      'Delete Pantry',
      'Are you sure you want to delete this pantry? This action cannot be undone and will remove all items in this pantry.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePantry({ variables: { id: pantryId } });
            goBack();
          },
        },
      ],
    );
  };

  // Show loading state while fetching pantry data
  if (pantryId && loadingPantry && !pantry) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBack()}>
            <Icon
              name="arrow-back"
              size={24}
              color={theme.colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.title}>Loading...</Text>
          <View style={{ width: 50 }} />
        </View>
        <View
          style={[
            styles.content,
            { justifyContent: 'center', alignItems: 'center' },
          ]}
        >
          <Text style={styles.label}>Loading pantry data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {!pantryId ? 'Create New Pantry' : 'Pantry Settings'}
        </Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButton}>
            {saving ? 'Saving...' : !pantryId ? 'Create' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pantry Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter pantry name (e.g., Kitchen Pantry)"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Default Pantry</Text>
              <Text style={styles.settingDescription}>
                Make this your default pantry for this home
              </Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ true: theme.colors.primary }}
            />
          </View>
        </View>

        {pantryId && pantry && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Information</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Items in pantry</Text>
              <Text style={styles.infoValue}>
                {pantry?.items?.length || 0} items
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created</Text>
              <Text style={styles.infoValue}>
                {new Date(pantry.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}

        {/* Only show danger zone if editing existing pantry */}
        {pantryId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
            >
              <Icon name="delete" size={20} color={theme.colors.error} />
              <Text style={styles.deleteButtonText}>Delete Pantry</Text>
            </TouchableOpacity>

            <Text style={styles.dangerWarning}>
              Deleting this pantry will permanently remove all items stored in
              it. This action cannot be undone.
            </Text>
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: 8,
    marginBottom: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.error,
    marginLeft: 8,
  },
  dangerWarning: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
}));
