import React, { useState, useEffect } from 'react';
import { View, Switch, ScrollView } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { alertService } from '#/services/alertService';
import { Icon } from '#/utils/iconUtils';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
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
import { useAppStore, useSelectedHomeId } from '#store/useAppStore';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { useErrorService, errorService } from '#/services/errorService';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { normalizePantry } from '#/utils/connectionUtils';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  executeWithLoadingState,
  executeAsyncWithCleanup,
} from '#/utils/compilerSafeWrappers';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { Text } from '#components/atoms/Text';

/** Module-level cache update closure for `useDeletePantryMutation`.
 *  Extracted from the component body so the surrounding try/catch does not
 *  trigger a React Compiler bailout. */
function buildDeletePantryUpdater(selectedHomeId: string | null | undefined) {
  return function deletePantryUpdater(
    cache: any,
    { data }: any,
    { variables }: any,
  ) {
    if (!data?.deletePantry?.pantry || !variables?.id || !selectedHomeId)
      return;
    try {
      const deletedPantryId = variables.id;
      const homeCacheId = cache.identify({
        __typename: 'Home',
        id: selectedHomeId,
      });
      if (!homeCacheId) return;

      cache.modify({
        id: homeCacheId,
        fields: {
          pantries(existingPantries: any[] = [], { readField }: any) {
            return existingPantries.filter(
              (pantryRef: any) =>
                readField('id', pantryRef) !== deletedPantryId,
            );
          },
          pantriesConnection(
            existingConnection: any = null,
            { readField }: any,
          ) {
            if (!existingConnection?.edges) return existingConnection;
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

      safeEvict(cache, 'Pantry', deletedPantryId);
    } catch (error) {
      console.warn('Cache update failed for deletePantry:', error);
    }
  };
}

/** Module-level cache update closure for `useCreatePantryMutation`.
 *  Extracted from the component body so the surrounding try/catch does not
 *  trigger a React Compiler bailout. */
function buildCreatePantryUpdater(selectedHomeId: string | null | undefined) {
  return function createPantryUpdater(cache: any, { data }: any) {
    const newPantry = data?.createPantry?.pantry;
    if (!newPantry || !selectedHomeId) return;
    try {
      const homeCacheId = cache.identify({
        __typename: 'Home',
        id: selectedHomeId,
      });
      if (!homeCacheId) return;

      cache.modify({
        id: homeCacheId,
        fields: {
          pantries(
            existingPantries: any[] = [],
            { readField, toReference }: any,
          ) {
            const newPantryRef = toReference(newPantry);
            const exists = existingPantries.some(
              (pantryRef: any) => readField('id', pantryRef) === newPantry.id,
            );
            if (exists) return existingPantries;
            return [...existingPantries, newPantryRef];
          },
          pantriesConnection(existingConnection: any = null) {
            if (!existingConnection) return existingConnection;
            const newEdge = {
              __typename: 'PantryEdge',
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
    }
  };
}

/** Module-level wrapper for `setDefaultPantry` mutation that swallows
 *  errors via errorService — extracted to keep try/catch out of the
 *  component body (React Compiler bailout). */
async function safeSetDefaultPantry(
  setDefaultPantry: (opts: { variables: { id: string } }) => Promise<unknown>,
  pantryId: string,
): Promise<void> {
  try {
    await setDefaultPantry({ variables: { id: pantryId } });
  } catch (error) {
    errorService.reportError(error, {
      operation: 'PantrySettings.setDefaultPantry',
    });
  }
}

/** Module-level helper to sync pantry form state from loaded data */
function syncPantryFormState(
  pantry:
    | {
        name?: string | null;
        description?: string | null;
        isDefault?: boolean | null;
      }
    | null
    | undefined,
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

export const PantrySettings: React.FC<
  StaticScreenProps<
    | {
        pantryId?: string;
      }
    | undefined
  >
> = ({ route }) => {
  const { goBack } = useAppNavigation();
  const { theme } = useUnistyles();
  const pantryId = route.params?.pantryId;

  const selectedHomeId = useSelectedHomeId();
  const setSelectedPantryId = useAppStore(state => state.setSelectedPantryId);
  const { handleApolloError } = useErrorService();
  const permissions = usePantryPermissions();

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
      storageLocationsFirst: 15,
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
      alertService.alert('Error', message);
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
      alertService.alert('Error', message);
    },
    // Update cache directly instead of refetching. Builder is module-scope to
    // keep try/catch out of the component body (React Compiler bailout).
    update: buildDeletePantryUpdater(selectedHomeId),
  });

  const [createPantry] = useCreatePantryMutation({
    // Update cache directly instead of refetching. Builder is module-scope to
    // keep try/catch out of the component body (React Compiler bailout).
    update: buildCreatePantryUpdater(selectedHomeId),
    onCompleted: data => {
      const newPantryResult = data?.createPantry?.pantry;
      if (newPantryResult) {
        setSelectedPantryId(newPantryResult.id);
      }
      goBack();
    },
    onError: () => {
      alertService.alert('Error', 'Failed to create pantry');
    },
  });

  useEffect(() => {
    // Handle error case
    if (pantryError && pantryId) {
      errorService.reportError(pantryError, {
        operation: 'PantrySettings.loadPantry',
      });
      alertService.alert(
        'Error Loading Pantry',
        'Failed to load pantry data. Please try again.',
      );
      return;
    }

    syncPantryFormState(
      pantry,
      pantryId,
      setName,
      setDescription,
      setIsDefault,
    );
  }, [pantry, pantryId, pantryError]);

  const handleToggleDefault = async (newValue: boolean) => {
    // Only call mutation if editing existing pantry
    if (!pantryId) {
      setIsDefault(newValue);
      return;
    }

    // Optimistically update UI
    setIsDefault(newValue);

    // Module-level helper keeps try/catch out of the component body.
    await safeSetDefaultPantry(setDefaultPantry, pantryId);
  };

  const handleSave = () => {
    if (!name.trim()) {
      alertService.alert('Error', 'Pantry name cannot be empty');
      return;
    }

    if (!selectedHomeId) {
      alertService.alert('Error', 'No home selected');
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
        alertService.alert(
          'Error',
          pantryId ? 'Failed to save settings' : 'Failed to create pantry',
        );
      },
    );
  };

  const handleDelete = () => {
    if (!pantryId) return;

    alertService.alert(
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
              () => {
                subscriptionService.unregisterParentDeletion(pantryId);
              },
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
          (
            !pantryId ? permissions.canManagePantry : permissions.canEditItems
          ) ? (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text size="md" weight="semibold" tone="accent">
                {saving ? 'Saving...' : !pantryId ? 'Create' : 'Save'}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      <ScrollView style={styles.content}>
        <View style={commonStyles.settingsSection}>
          <Text style={commonStyles.settingsSectionTitle}>General</Text>

          <BaseInput
            label="Pantry Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter pantry name (e.g., Kitchen Pantry)"
          />

          <BaseInput
            label="Description (Optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Enter description"
            multiline
            numberOfLines={3}
          />

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

            <InfoRow
              label="Items in pantry"
              value={`${pantry?.items?.length || 0} items`}
            />
          </View>
        )}

        {/* Only show danger zone if editing existing pantry and user can manage */}
        {!!pantryId && permissions.canManagePantry ? (
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
              <Text
                size="md"
                weight="semibold"
                tone="error"
                style={styles.deleteButtonText}
              >
                Delete Pantry
              </Text>
            </Pressable>

            <Text
              size="sm"
              tone="secondary"
              lineHeight="normal"
              style={styles.dangerWarning}
            >
              Deleting this pantry will permanently remove all items stored in
              it. This action cannot be undone.
            </Text>
          </View>
        ) : null}
      </ScrollView>
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
    marginLeft: theme.spacing.sm,
  },
  dangerWarning: {
    fontStyle: 'italic',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
