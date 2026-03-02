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
import { Icon } from '#/utils/iconUtils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { ScreenHeader } from '#components/molecules/ScreenHeader';
import { LoadingInline } from '#components/base/Loading';
import { InfoRow } from '#components/molecules/InfoRow';
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
import { executeWithLoadingState, executeAsyncWithCleanup } from '#/utils/compilerSafeWrappers';

/** Module-level helper to sync pantry form state from loaded data */
function syncPantryFormState(
  pantry: { name?: string | null; description?: string | null; isDefault?: boolean | null } | null | undefined,
  pantryId: string | undefined,
  setName: (v: string) => void,
  setDescription: (v: string) => void,
  setIsDefault: (v: boolean) => void,
) {
  if (pantry && pantryId) {
    setName(pantry.name || '');
    setDescription(pantry.description || '');
    setIsDefault(pantry.isDefault || false);
  } else if (!pantryId) {
    setName('');
    setDescription('');
    setIsDefault(false);
  }
}

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
  const pantry = normalizePantry(pantryData?.pantry);

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

    syncPantryFormState(pantry, pantryId, setName, setDescription, setIsDefault);
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

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Pantry name cannot be empty');
      return;
    }

    if (!selectedHomeId) {
      Alert.alert('Error', 'No home selected');
      return;
    }

    executeWithLoadingState(
      async () => {
        if (!pantryId) {
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
      },
      setSaving,
      () => {
        Alert.alert(
          'Error',
          pantryId ? 'Failed to save settings' : 'Failed to create pantry',
        );
      },
    );
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
          onPress: () => {
            // Register parent deletion to prevent subscription race conditions
            subscriptionService.registerParentDeletion(pantryId);

            executeAsyncWithCleanup(
              async () => {
                await deletePantry({ variables: { id: pantryId } });
                setSelectedPantryId(null);
                goBack();
              },
              // Cleanup (timeout in service provides fallback)
              () => { subscriptionService.unregisterParentDeletion(pantryId); },
            );
          },
        },
      ],
    );
  };

  // Show loading state while fetching pantry data
  if (pantryId && loadingPantry && !pantry) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Loading..." onBack={goBack} />
        <LoadingInline message="Loading pantry data..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={!pantryId ? 'Create New Pantry' : 'Pantry Settings'}
        onBack={goBack}
        rightElement={
          <Pressable onPress={handleSave} disabled={saving} style={({pressed}) => pressed && styles.pressed}>
            <Text style={styles.saveButton}>
              {saving ? 'Saving...' : !pantryId ? 'Create' : 'Save'}
            </Text>
          </Pressable>
        }
      />

      <ScrollView style={styles.content}>
        <View style={commonStyles.settingsSection}>
          <Text style={commonStyles.settingsSectionTitle}>General</Text>

          <View style={commonStyles.settingsInputGroup}>
            <Text style={commonStyles.settingsLabel}>Pantry Name</Text>
            <TextInput
              style={commonStyles.settingsInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter pantry name (e.g., Kitchen Pantry)"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          <View style={commonStyles.settingsInputGroup}>
            <Text style={commonStyles.settingsLabel}>Description (Optional)</Text>
            <TextInput
              style={commonStyles.settingsInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter description"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={commonStyles.settingsRow}>
            <View style={commonStyles.settingsRowInfo}>
              <Text style={commonStyles.settingsRowLabel}>Default Pantry</Text>
              <Text style={commonStyles.settingsRowDescription}>
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

        {!!pantryId && !!pantry && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>Information</Text>

            <InfoRow label="Items in pantry" value={`${pantry?.items?.length || 0} items`} />

            <InfoRow label="Created" value={new Date(pantry.createdAt).toLocaleDateString()} />
          </View>
        )}

        {/* Only show danger zone if editing existing pantry */}
        {!!pantryId && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>Danger Zone</Text>

            <Pressable
              style={({pressed}) => [styles.deleteButton, pressed && styles.pressed]}
              onPress={handleDelete}
            >
              <Icon name="trash-outline" size={20} color={theme.colors.error} />
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
  saveButton: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
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
