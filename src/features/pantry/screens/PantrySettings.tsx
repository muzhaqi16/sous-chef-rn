import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { Icon } from '#/utils/iconUtils';
import { useTranslation } from '#/i18n';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { ScreenHeader } from '#components/molecules/ScreenHeader';
import { LoadingInline } from '#components/atoms/Loading';
import { InfoRow } from '#components/molecules/InfoRow';
import { useApolloClient, useQuery, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  GetPantryDocument,
  UpdatePantryDocument,
  DeletePantryDocument,
  CreatePantryDocument,
  MarkPantryAsDefaultDocument,
  type DeletePantryMutation,
  type DeletePantryMutationVariables,
  type CreatePantryMutation,
} from '#features/pantry/graphql/pantry.generated';
import { useSelectedHomeId, useSetSelectedPantryId } from '#store/useAppStore';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { errorService } from '#/services/errorService';
import { handleMutationError } from '#/utils/errorHandlers';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  executeWithLoadingState,
  executeAsyncWithCleanup,
} from '#/utils/finallyHelpers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  alertIfRejected,
  alertRejectedMutation,
} from '#/apollo/utils/alertRejectedMutation';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  addPantryToHomeCache,
  buildOptimisticPantry,
  removeOptimisticPantry,
  writeOptimisticPantry,
} from '#features/pantry/utils/optimisticPantry';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { Text } from '#components/atoms/Text';
import { logger } from '#/utils/environment';

/** Module-level cache update closure for `useDeletePantryMutation`.
 *  Extracted from the component body so the surrounding try/catch does not
 *  trigger a React Compiler bailout. */
function buildDeletePantryUpdater(selectedHomeId: string | null | undefined) {
  return function deletePantryUpdater(
    cache: ApolloCache,
    { data }: { data?: DeletePantryMutation | null },
    { variables }: { variables?: DeletePantryMutationVariables },
  ) {
    // Keyed off the VARIABLES, not the payload: `DeletePantryPayload.pantry` is
    // nullable — the server returns it null when the row was already gone — so a
    // guard on it would skip the cache update for exactly that case.
    const isDeletePayload =
      data?.deletePantry?.__typename === 'DeletePantryPayload';
    if (!isDeletePayload || !variables?.input?.id || !selectedHomeId) return;
    try {
      removeOptimisticPantry(cache, selectedHomeId, variables.input.id);
    } catch (error) {
      logger.warn('Cache update failed for deletePantry:', error);
    }
  };
}

/** Module-level cache update closure for `useCreatePantryMutation`.
 *  Extracted from the component body so the surrounding try/catch does not
 *  trigger a React Compiler bailout. Idempotent by pantry id — the
 *  local-first pre-fire write already inserted the same client-minted id. */
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
      addPantryToHomeCache(cache, selectedHomeId, newPantry);
    } catch (error) {
      logger.warn('Cache update failed for createPantry:', error);
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
  const apolloClient = useApolloClient();
  const permissions = usePantryPermissions();
  const isApiUnavailable = useIsApiUnavailable();

  // Renaming, deleting and re-flagging an existing pantry are online-only.
  // Creating one is not: the pantry it mints is the parent a queued
  // `createPantryItem` references, so that path stays local-first.
  const editOffline = !!pantryId && isApiUnavailable;

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

  const [setDefaultPantry] = useMutation(MarkPantryAsDefaultDocument, {
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
    onError: () => {
      alertService.alert(t('labels.error'), t('pantrySettings.createFailed'));
    },
  });

  // Report + announce a failed load. Kept apart from the form sync below: `t`
  // is a dependency here, and a language change must not re-run the sync and
  // overwrite whatever the user has typed.
  useEffect(() => {
    if (!pantryError || !pantryId) return;
    errorService.reportError(pantryError, {
      operation: 'PantrySettings.loadPantry',
    });
    alertService.alert(
      t('pantrySettings.loadErrorTitle'),
      t('pantrySettings.loadErrorMessage'),
    );
  }, [pantryError, pantryId, t]);

  useEffect(() => {
    if (pantryError && pantryId) return;
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

    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return;
    }

    // Optimistically update UI
    setIsDefault(newValue);

    // Module-level helper keeps try/catch out of the component body.
    await safeSetDefaultPantry(setDefaultPantry, pantryId);
  };

  const handleSave = () => {
    if (editOffline) {
      toastService.error(t('errors.notAvailableOffline'));
      return;
    }

    if (!name.trim()) {
      alertService.alert(t('labels.error'), t('pantrySettings.nameEmptyError'));
      return;
    }

    if (!selectedHomeId) {
      alertService.alert(t('labels.error'), t('errors.noHomeSelected'));
      return;
    }

    executeWithLoadingState(
      async () => {
        if (!pantryId) {
          // Local-first: mint the permanent cuid (the row's real PK) and
          // write the pantry — entity, zeroed stats, empty item/storage
          // connections, home membership lists — before firing, so creation
          // works fully offline and items can be added to it immediately.
          const id = generateEntityId();
          const input = {
            id,
            homeId: selectedHomeId,
            name: name.trim(),
            description:
              description.trim() || t('pantrySettings.userCreatedDescription'),
            isDefault,
            tags: ['user-created'],
          };
          const optimisticPantry = buildOptimisticPantry(id, input);
          try {
            writeOptimisticPantry(apolloClient.cache, optimisticPantry);
            addPantryToHomeCache(
              apolloClient.cache,
              selectedHomeId,
              optimisticPantry,
            );
          } catch (cacheError) {
            errorService.reportError(cacheError, {
              operation: 'Create Pantry (optimistic)',
            });
          }

          const result = await createPantry({
            variables: { input },
            context: { localFirst: true },
          });
          const outcome = classifyCreateResult(result);
          if (outcome === 'rejected') {
            try {
              removeOptimisticPantry(apolloClient.cache, selectedHomeId, id);
            } catch (cacheError) {
              errorService.reportError(cacheError, {
                operation: 'Revert rejected Pantry create',
              });
            }
            // The mutation's onError already alerts on a transport error
            // (`result.error`); alert here only for a resolved error-union
            // payload so exactly one alert fires.
            const payload = result.data?.createPantry;
            const message =
              payload && 'message' in payload ? payload.message : null;
            alertRejectedMutation(
              result,
              message ?? t('pantrySettings.createFailed'),
            );
            return;
          }
          // Online success echoes the same id; queued keeps the local entity
          // and replays keyed by it — select it and leave either way.
          setSelectedPantryId(id);
          goBack();
        } else {
          // Online-only: the mutation returns the Pantry, which Apollo
          // normalizes by `__typename + id`, so no cache write of our own.
          const updates = {
            name: name.trim(),
            description: description.trim(),
          };
          const result = await updatePantry({
            variables: { input: { id: pantryId, ...updates } },
          });
          // `updatePantry` has no `onError`, so this has to surface the
          // transport-error case too.
          alertIfRejected(result, t('errors.saveSettingsFailed'));
        }
      },
      setSaving,
      () => {
        alertService.alert(
          t('labels.error'),
          pantryId
            ? t('errors.saveSettingsFailed')
            : t('pantrySettings.createFailed'),
        );
      },
    );
  };

  const handleDelete = () => {
    if (!pantryId) return;

    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return;
    }

    alertService.alert(
      t('labels.deletePantry'),
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
                const result = await deletePantry({
                  variables: { input: { id: pantryId } },
                });
                // `errorPolicy: 'all'` resolves a refusal instead of throwing,
                // and the delete is online-only now, so "it resolved" no longer
                // means "it happened". Navigating away on a failed delete left
                // the pantry selected-as-null and the row still on the server.
                if (
                  result.data?.deletePantry?.__typename !==
                  'DeletePantryPayload'
                ) {
                  return;
                }
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
            !pantryId ? permissions.canCreatePantry : permissions.canEditItems
          ) ? (
            <Pressable
              onPress={handleSave}
              disabled={saving || editOffline}
              style={({ pressed }) => [
                pressed && styles.pressed,
                editOffline && styles.disabled,
              ]}
            >
              <Text size="md" weight="semibold" tone="accent">
                {saving
                  ? t('labels.saving')
                  : !pantryId
                  ? t('labels.create')
                  : t('labels.save')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView style={styles.content}>
        <View style={commonStyles.settingsSection}>
          <Text style={commonStyles.settingsSectionTitle}>
            {t('labels.general')}
          </Text>

          <BaseInput
            label={t('labels.pantryName')}
            value={name}
            onChangeText={setName}
            placeholder={t('pantrySettings.namePlaceholder')}
          />

          <BaseInput
            label={t('storageLocationForm.descriptionLabel')}
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
            <BaseSwitch
              value={isDefault}
              onValueChange={handleToggleDefault}
              disabled={editOffline}
            />
          </View>
        </View>

        {!!pantryId && !!pantry && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('labels.information')}
            </Text>

            <InfoRow
              label={t('pantrySettings.itemsInPantry')}
              value={t('pantrySettings.itemsCount', {
                count: pantryItemCount,
              })}
            />
          </View>
        )}

        {/* Only show danger zone if editing existing pantry and user can delete */}
        {!!pantryId && permissions.canDeletePantry ? (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('labels.dangerZone')}
            </Text>

            <AppPressable
              style={[styles.deleteButton, editOffline && styles.disabled]}
              onPress={handleDelete}
              disabled={editOffline}
            >
              <Icon name="trash-outline" size={20} tone="error" />
              <Text
                size="md"
                weight="semibold"
                tone="error"
                style={styles.deleteButtonText}
              >
                {t('labels.deletePantry')}
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
    borderCurve: 'continuous',
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
  disabled: {
    opacity: theme.opacity.disabled,
  },
}));
