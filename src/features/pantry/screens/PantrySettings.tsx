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
import {
  snapshotFields,
  updateEntityFieldsLocalFirst,
} from '#/apollo/utils/localFirstFields';
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
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  addPantryToHomeCache,
  buildOptimisticPantry,
  removeOptimisticPantry,
  restorePantryToHomeCache,
  writeOptimisticPantry,
} from '#features/pantry/utils/optimisticPantry';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { Text } from '#components/atoms/Text';
import { logger } from '#/utils/environment';

/** Module-level so the try/catch does not bail the component out of the compiler. */
function buildDeletePantryUpdater(selectedHomeId: string | null | undefined) {
  return function deletePantryUpdater(
    cache: ApolloCache,
    { data }: { data?: DeletePantryMutation | null },
    { variables }: { variables?: DeletePantryMutationVariables },
  ) {
    // Keyed off the VARIABLES: `DeletePantryPayload.pantry` is null when the
    // server converges a replay, exactly the case this has to handle.
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

/** Module-level so the try/catch does not bail the component out of the compiler.
 *  Idempotent by pantry id — the pre-fire write already inserted the same one. */
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

/** Module-level so the try/catch does not bail the component out of the compiler. */
async function safeSetDefaultPantry(
  setDefaultPantry: (opts: {
    variables: { input: { id: string } };
    context?: { localFirst: boolean };
  }) => Promise<unknown>,
  pantryId: string,
): Promise<void> {
  try {
    await setDefaultPantry({
      variables: { input: { id: pantryId } },
      // Absolute flag on an existing row, so a replay lands the same state.
      context: { localFirst: true },
    });
  } catch (error) {
    errorService.reportError(error, {
      operation: 'PantrySettings.setDefaultPantry',
    });
  }
}

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

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // Gates the `pantryId!` assertion below.
  const hasValidPantryId = !!pantryId?.trim();

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

  const pantry = pantryData?.pantry;
  const pantryItemCount = pantry?.itemsConnection?.totalCount ?? 0;

  const [updatePantry] = useMutation(UpdatePantryDocument, {
    // No `update`: Apollo merges the returned Pantry entity, and membership
    // lists are unchanged by an edit.
  });

  const [setDefaultPantry] = useMutation(MarkPantryAsDefaultDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Set Default Pantry' });
      setIsDefault(!isDefault);
    },
  });

  const [deletePantry] = useMutation(DeletePantryDocument, {
    onError: error => {
      handleMutationError(error, { operation: 'Delete Pantry' });
    },
    update: buildDeletePantryUpdater(selectedHomeId),
  });

  const [createPantry] = useMutation(CreatePantryDocument, {
    update: buildCreatePantryUpdater(selectedHomeId),
    onError: () => {
      alertService.alert(t('labels.error'), t('pantrySettings.createFailed'));
    },
  });

  // Kept apart from the form sync below: `t` is a dependency here, and a language
  // change must not re-run the sync over whatever the user has typed.
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
    if (!pantryId) {
      setIsDefault(newValue);
      return;
    }

    setIsDefault(newValue);
    await safeSetDefaultPantry(setDefaultPantry, pantryId);
  };

  const handleSave = () => {
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
          // Local-first: mint the row's real PK and write the complete pantry
          // before firing, so creation works offline and takes items at once.
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
            // `onError` already alerts on a transport error, so this covers only
            // a resolved error-union payload — exactly one alert either way.
            const payload = result.data?.createPantry;
            const message =
              payload && 'message' in payload ? payload.message : null;
            alertRejectedMutation(
              result,
              message ?? t('pantrySettings.createFailed'),
            );
            return;
          }
          // Online echoes the same id, queued replays keyed by it — select and
          // leave either way.
          setSelectedPantryId(id);
          goBack();
        } else {
          // Absolute field write on an existing row, so a replay lands the same
          // state — safe to queue, and the rename shows immediately.
          const updates = {
            name: name.trim(),
            description: description.trim(),
          };
          await updateEntityFieldsLocalFirst({
            cache: apolloClient.cache,
            entity: { __typename: 'Pantry', id: pantryId },
            updates,
            // Omits keys the read did not carry, so a refusal arriving before
            // the query resolves reverts nothing. `pantry?.name ?? ''` would
            // instead write an empty name over the real one.
            previous: snapshotFields(pantry, updates),
            logLabel: 'PantrySettings.updatePantry',
            mutate: () =>
              updatePantry({
                variables: { input: { id: pantryId, ...updates } },
                context: { localFirst: true },
              }),
          });
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

    alertService.alert(
      t('labels.deletePantry'),
      t('pantrySettings.deleteConfirmMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.delete'),
          style: 'destructive',
          onPress: () => {
            // Stops the subscription racing the delete.
            subscriptionService.registerParentDeletion(pantryId);

            executeAsyncWithCleanup(
              async () => {
                // Written HERE, before firing: offline there is no
                // `DeletePantryPayload`, so `buildDeletePantryUpdater` never
                // runs and the queued replay carries no `update` at all.
                // Unlinks without evicting — the entity must survive a refusal
                // for `restorePantryToHomeCache` to put the row back.
                if (selectedHomeId) {
                  try {
                    removeOptimisticPantry(
                      apolloClient.cache,
                      selectedHomeId,
                      pantryId,
                      { evictEntity: false },
                    );
                  } catch (cacheError) {
                    errorService.reportError(cacheError, {
                      operation: 'Delete Pantry (optimistic)',
                    });
                  }
                }

                // Safe to queue: the delete converges server-side on replay
                // (`converged: true` for an already-deleted row).
                const result = await deletePantry({
                  variables: { input: { id: pantryId } },
                  context: { localFirst: true },
                });

                if (classifyCreateResult(result) === 'rejected') {
                  if (selectedHomeId) {
                    try {
                      restorePantryToHomeCache(
                        apolloClient.cache,
                        selectedHomeId,
                        pantryId,
                      );
                    } catch (cacheError) {
                      errorService.reportError(cacheError, {
                        operation: 'Revert rejected Pantry delete',
                      });
                    }
                  }
                  alertRejectedMutation(result, t('errors.deletePantryFailed'));
                  return;
                }

                setSelectedPantryId(null);
                goBack();
              },
              () => {
                subscriptionService.unregisterParentDeletion(pantryId);
              },
            );
          },
        },
      ],
    );
  };

  // `loading && !pantry` — a cached copy renders instead of blanking the screen.
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
              disabled={saving}
              style={({ pressed }) => pressed && styles.pressed}
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
            <BaseSwitch value={isDefault} onValueChange={handleToggleDefault} />
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

            <AppPressable style={styles.deleteButton} onPress={handleDelete}>
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
}));
