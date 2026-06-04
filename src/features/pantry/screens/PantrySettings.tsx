import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { Icon } from '#/utils/iconUtils';
import { useTranslation } from 'react-i18next';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { ScreenHeader } from '#components/molecules/ScreenHeader';
import { LoadingInline } from '#components/base/Loading';
import { InfoRow } from '#components/molecules/InfoRow';
import { useQuery, useMutation } from '@apollo/client/react';
import type { ApolloCache, Reference } from '@apollo/client';
import type { ModifierDetails } from '@apollo/client/cache';
import type { ConnectionData } from '#/apollo/utils/cacheUpdaters';
import {
  GetPantryDocument,
  UpdatePantryDocument,
  DeletePantryDocument,
  CreatePantryDocument,
  SetDefaultPantryDocument,
  type DeletePantryMutation,
  type DeletePantryMutationVariables,
  type CreatePantryMutation,
} from '#features/pantry/graphql/pantry.generated';
import { useSelectedHomeId, useSetSelectedPantryId } from '#store/useAppStore';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { errorService } from '#/services/errorService';
import { handleMutationError } from '#/utils/errorHandlers';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
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
    cache: ApolloCache,
    { data }: { data?: DeletePantryMutation | null },
    { variables }: { variables?: DeletePantryMutationVariables },
  ) {
    const deletePayload =
      data?.deletePantry?.__typename === 'DeletePantryPayload'
        ? data.deletePantry
        : null;
    if (!deletePayload?.pantry || !variables?.input?.id || !selectedHomeId)
      return;
    try {
      const deletedPantryId = variables.input.id;
      const homeCacheId = cache.identify({
        __typename: 'Home',
        id: selectedHomeId,
      });
      if (!homeCacheId) return;

      cache.modify({
        id: homeCacheId,
        fields: {
          pantries(
            existingPantries: readonly Reference[] = [],
            { readField }: ModifierDetails,
          ) {
            return existingPantries.filter(
              pantryRef => readField('id', pantryRef) !== deletedPantryId,
            );
          },
          pantriesConnection(
            existingConnection: ConnectionData | null = null,
            { readField }: ModifierDetails,
          ) {
            if (!existingConnection?.edges) return existingConnection;
            const filteredEdges = existingConnection.edges.filter(
              edge => readField('id', edge?.node) !== deletedPantryId,
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
  return function createPantryUpdater(
    cache: ApolloCache,
    { data }: { data?: CreatePantryMutation | null },
  ) {
    const newPantry =
      data?.createPantry?.__typename === 'CreatePantryPayload'
        ? data.createPantry.pantry
        : null;
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
            existingPantries: readonly Reference[] = [],
            { readField, toReference }: ModifierDetails,
          ) {
            const newPantryRef = toReference(newPantry);
            const exists = existingPantries.some(
              pantryRef => readField('id', pantryRef) === newPantry.id,
            );
            if (exists || !newPantryRef) return existingPantries;
            return [...existingPantries, newPantryRef];
          },
          pantriesConnection(
            existingConnection: ConnectionData | null = null,
            { toReference }: ModifierDetails,
          ) {
            if (!existingConnection) return existingConnection;
            const newPantryRef = toReference(newPantry);
            if (!newPantryRef) return existingConnection;
            const newEdge = {
              __typename: 'PantryEdge',
              cursor: newPantry.id,
              node: newPantryRef,
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
  setDefaultPantry: (opts: {
    variables: { input: { id: string } };
  }) => Promise<unknown>,
  pantryId: string,
): Promise<void> {
  try {
    await setDefaultPantry({ variables: { input: { id: pantryId } } });
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
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
  const pantryId = route.params?.pantryId;

  const selectedHomeId = useSelectedHomeId();
  const setSelectedPantryId = useSetSelectedPantryId();
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
  } = useQuery(GetPantryDocument, {
    variables: {
      id: pantryId!,
      itemsFirst: 25,
      storageLocationsFirst: 15,
    },
    skip: !hasValidPantryId,
  });

  // Pantry data — read directly; consumers below use items count from connection
  const pantry = pantryData?.pantry;
  const pantryItemCount = pantry?.itemsConnection?.totalCount ?? 0;

  const [updatePantry] = useMutation(UpdatePantryDocument, {
    // Update cache directly - Apollo automatically merges the Pantry entity
    // No need to update home's pantries array since the pantry is just updated, not added/removed
  });

  const [setDefaultPantry] = useMutation(SetDefaultPantryDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Set Default Pantry' });
      // Revert the toggle on error
      setIsDefault(!isDefault);
    },
  });

  const [deletePantry] = useMutation(DeletePantryDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Delete Pantry' });
    },
    // Update cache directly instead of refetching. Builder is module-scope to
    // keep try/catch out of the component body (React Compiler bailout).
    update: buildDeletePantryUpdater(selectedHomeId),
  });

  const [createPantry] = useMutation(CreatePantryDocument, {
    // Update cache directly instead of refetching. Builder is module-scope to
    // keep try/catch out of the component body (React Compiler bailout).
    update: buildCreatePantryUpdater(selectedHomeId),
    onCompleted: data => {
      const payload = data?.createPantry;
      if (payload?.__typename === 'CreatePantryPayload') {
        setSelectedPantryId(payload.pantry.id);
      }
      goBack();
    },
    onError: () => {
      alertService.alert(t('labels.error'), t('pantrySettings.createFailed'));
    },
  });

  useEffect(() => {
    // Handle error case
    if (pantryError && pantryId) {
      errorService.reportError(pantryError, {
        operation: 'PantrySettings.loadPantry',
      });
      alertService.alert(
        t('pantrySettings.loadErrorTitle'),
        t('pantrySettings.loadErrorMessage'),
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
      alertService.alert(t('labels.error'), t('pantrySettings.nameEmptyError'));
      return;
    }

    if (!selectedHomeId) {
      alertService.alert(t('labels.error'), t('pantrySettings.noHomeError'));
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
                description:
                  description.trim() ||
                  t('pantrySettings.userCreatedDescription'),
                isDefault,
                tags: ['user-created'],
              },
            },
          });
        } else {
          await updatePantry({
            variables: {
              input: {
                id: pantryId,
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
          t('labels.error'),
          pantryId
            ? t('pantrySettings.saveFailed')
            : t('pantrySettings.createFailed'),
        );
      },
    );
  };

  const handleDelete = () => {
    if (!pantryId) return;

    alertService.alert(
      t('pantrySettings.deleteConfirmTitle'),
      t('pantrySettings.deleteConfirmMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.delete'),
          style: 'destructive',
          onPress: () => {
            // Register parent deletion to prevent subscription race conditions
            subscriptionService.registerParentDeletion(pantryId);

            executeAsyncWithCleanup(
              async () => {
                await deletePantry({ variables: { input: { id: pantryId } } });
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
        <ScreenHeader title={t('pantrySettings.loading')} onBack={goBack} />
        <LoadingInline message={t('pantrySettings.loadingData')} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={
          !pantryId
            ? t('pantrySettings.createTitle')
            : t('pantrySettings.title')
        }
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
                {saving
                  ? t('pantrySettings.saving')
                  : !pantryId
                  ? t('pantrySettings.create')
                  : t('pantrySettings.save')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView style={styles.content}>
        <View style={commonStyles.settingsSection}>
          <Text style={commonStyles.settingsSectionTitle}>
            {t('pantrySettings.general')}
          </Text>

          <BaseInput
            label={t('pantrySettings.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('pantrySettings.namePlaceholder')}
          />

          <BaseInput
            label={t('pantrySettings.descriptionLabel')}
            value={description}
            onChangeText={setDescription}
            placeholder={t('pantrySettings.descriptionPlaceholder')}
            multiline
            numberOfLines={3}
          />

          <View style={commonStyles.settingsRow}>
            <View style={commonStyles.settingsRowInfo}>
              <Text style={commonStyles.settingsRowLabel}>
                {t('pantrySettings.defaultPantry')}
              </Text>
              <Text style={commonStyles.settingsRowDescription}>
                {t('pantrySettings.defaultPantryDesc')}
              </Text>
            </View>
            <BaseSwitch value={isDefault} onValueChange={handleToggleDefault} />
          </View>
        </View>

        {!!pantryId && !!pantry && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('pantrySettings.information')}
            </Text>

            <InfoRow
              label={t('pantrySettings.itemsInPantry')}
              value={t('pantrySettings.itemsCount', {
                count: pantryItemCount,
              })}
            />
          </View>
        )}

        {/* Only show danger zone if editing existing pantry and user can manage */}
        {!!pantryId && permissions.canManagePantry ? (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('pantrySettings.dangerZone')}
            </Text>

            <AppPressable style={styles.deleteButton} onPress={handleDelete}>
              <Icon name="trash-outline" size={20} tone="error" />
              <Text
                size="md"
                weight="semibold"
                tone="error"
                style={styles.deleteButtonText}
              >
                {t('pantrySettings.deletePantry')}
              </Text>
            </AppPressable>

            <Text
              size="sm"
              tone="secondary"
              lineHeight="normal"
              style={styles.dangerWarning}
            >
              {t('pantrySettings.deleteWarning')}
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
