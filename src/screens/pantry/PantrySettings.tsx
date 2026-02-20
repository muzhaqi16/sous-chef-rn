import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { Icon } from '#/utils/iconUtils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import {
  useGetPantryQuery,
  useUpdatePantryMutation,
  useDeletePantryMutation,
  useCreatePantryMutation,
  useSetDefaultPantryMutation,
} from '#generated';
import { useAppStore, selectSelectedHomeId } from '#store/useAppStore';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { useErrorService, errorService } from '#/services/errorService';
import { normalizePantry } from '#/utils/connectionUtils';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';

export const PantrySettings: React.FC<StaticScreenProps<{
  pantryId?: string;
} | undefined>> = ({ route }) => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const pantryId = route.params?.pantryId;

  const selectedHomeId = useAppStore(selectSelectedHomeId);
  const setSelectedPantryId = useAppStore(state => state.setSelectedPantryId);
  const { handleApolloError } = useErrorService();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Explicit validation - only execute query when pantryId is genuinely valid
  const hasValidPantryId = !!pantryId?.trim();

  // skip controls execution - when skip is false, pantryId is guaranteed valid
  const {
    data: pantryData,
    loading: loadingPantry,
    error: pantryError,
  } = useGetPantryQuery({
    variables: {
      id: pantryId!,
      itemsFirst: 25,
      storageLocationsFirst: 50,
    },
    skip: !hasValidPantryId,
  });

  // Memoize normalized pantry to prevent re-creating on every render
  const pantry = useMemo(
    () => normalizePantry(pantryData?.pantry),
    [pantryData?.pantry],
  );

  const [updatePantry] = useUpdatePantryMutation({
    // Update cache directly - Apollo automatically merges the Pantry entity
    // No need to update home's pantries array since the pantry is just updated, not added/removed
  });

  const [setDefaultPantry] = useSetDefaultPantryMutation({
    errorPolicy: 'all',
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Set Default Pantry',
      });
      Alert.alert('Error', message);
      // Revert the toggle on error
      setIsDefault(!isDefault);
    },
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
      if (!data?.deletePantry?.pantry || !variables?.id || !selectedHomeId) return;

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
                    (filteredEdges.length < existingConnection.edges.length
                      ? 1
                      : 0),
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
      const newPantry = data?.createPantry?.pantry;
      if (!newPantry || !selectedHomeId) return;

      try {

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
                __typename: 'PantryEdge' as const,
                cursor: newPantry.id,
                node: newPantry,
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
      const newPantryResult = data?.createPantry?.pantry;
      if (newPantryResult) {
        // Set the newly created pantry as selected if it's marked as default
        if (isDefault) {
          setSelectedPantryId(newPantryResult.id);
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
      errorService.reportError(pantryError, { operation: 'PantrySettings.loadPantry' });
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

  const handleToggleDefault = async (newValue: boolean) => {
    // Only call mutation if editing existing pantry
    if (!pantryId) {
      setIsDefault(newValue);
      return;
    }

    // Optimistically update UI
    setIsDefault(newValue);

    try {
      await setDefaultPantry({
        variables: {
          id: pantryId,
        },
      });
    } catch (error) {
      errorService.reportError(error, { operation: 'PantrySettings.setDefaultPantry' });
    }
  };

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
        // Update existing pantry (isDefault is handled separately via handleToggleDefault)
        await updatePantry({
          variables: {
            id: pantryId,
            input: {
              name: name.trim(),
              description: description.trim(),
            },
          },
        });
      }
    } catch {
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
            // Register parent deletion to prevent subscription race conditions
            subscriptionService.registerParentDeletion(pantryId);

            try {
              await deletePantry({ variables: { id: pantryId } });
              // Clear selected pantry ID to prevent stale queries on next app start
              // useDefaultHome will auto-select a new pantry from remaining ones
              setSelectedPantryId(null);
              goBack();
            } finally {
              // Cleanup (timeout in service provides fallback)
              subscriptionService.unregisterParentDeletion(pantryId);
            }
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
          <Pressable onPress={() => goBack()} style={({pressed}) => pressed && styles.pressed}>
            <Icon
              name="arrow-back"
              size={24}
              color={theme.colors.textPrimary}
            />
          </Pressable>
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
        <Pressable onPress={() => goBack()} style={({pressed}) => pressed && styles.pressed}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>
          {!pantryId ? 'Create New Pantry' : 'Pantry Settings'}
        </Text>
        <Pressable onPress={handleSave} disabled={saving} style={({pressed}) => pressed && styles.pressed}>
          <Text style={styles.saveButton}>
            {saving ? 'Saving...' : !pantryId ? 'Create' : 'Save'}
          </Text>
        </Pressable>
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
              onValueChange={handleToggleDefault}
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

            <Pressable
              style={({pressed}) => [styles.deleteButton, pressed && styles.pressed]}
              onPress={handleDelete}
            >
              <Icon name="delete" size={20} color={theme.colors.error} />
              <Text style={styles.deleteButtonText}>Delete Pantry</Text>
            </Pressable>

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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'],
  },
  infoLabel: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textSecondary,
  },
  infoValue: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing['3'],
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing['3'],
  },
  deleteButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.error,
    marginLeft: theme.spacing.sm,
  },
  dangerWarning: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.normal,
    fontStyle: 'italic',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
