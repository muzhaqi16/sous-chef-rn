import React, { useState, useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { alertService } from '#/services/alertService';
import { Icon } from '#components/atoms/Icon';
import { useTranslation } from '#/i18n';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { Loading } from '#components/molecules/Loading';
import { InfoRow } from '#components/atoms/InfoRow';
import { usePantrySettings } from '#features/pantry/hooks/usePantrySettings';
import { useSelectedHomeId, useSetSelectedPantryId } from '#store/useAppStore';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import type { StaticScreenProps } from '@react-navigation/native';
import { errorService } from '#/services/errorService';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  executeWithLoadingState,
  executeAsyncWithCleanup,
} from '#/utils/finallyHelpers';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { Text } from '#components/atoms/Text';
import { SubScreen } from '#components/templates/SubScreen';
import { destructiveConfirm } from '#/services/destructiveConfirm';
import { reportValidationErrors } from '#/utils/validation/common';
import {
  EMPTY_PANTRY_SETTINGS,
  MAX_PANTRY_DESCRIPTION_LENGTH,
  pantrySettingsSchema,
  type PantrySettingsFormValues,
} from './pantrySettingsFormConfig';

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

  const [saving, setSaving] = useState(false);

  const {
    pantry,
    pantryItemCount,
    loadingPantry,
    pantryError,
    setDefault,
    createPantry,
    savePantryFields,
    deletePantry,
  } = usePantrySettings({ pantryId, homeId: selectedHomeId });

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

  const readValues: PantrySettingsFormValues | undefined =
    pantry && !pantryError
      ? {
          name: pantry.name,
          description: pantry.description ?? '',
          isDefault: pantry.isDefault,
        }
      : undefined;
  const { control, handleSubmit, setValue } = useForm<PantrySettingsFormValues>(
    {
      resolver: yupResolver(pantrySettingsSchema),
      // `values` lands in an effect after the first render, so a pantry cached
      // at mount seeds the defaults too.
      defaultValues: readValues ?? EMPTY_PANTRY_SETTINGS,
      // The pantry as read, whenever it changes; a field the user has touched
      // keeps what they typed.
      values: readValues,
      resetOptions: { keepDirtyValues: true },
      mode: 'onTouched',
    },
  );
  const [name, description] = useWatch({
    control,
    name: ['name', 'description'],
  });

  const handleToggleDefault = async (newValue: boolean) => {
    setValue('isDefault', newValue, { shouldDirty: true });
    if (!pantryId) return;
    // Put the switch back when the flag did not stick.
    if (!(await setDefault(pantryId))) setValue('isDefault', !newValue);
  };

  // Save writes the name and description; the default flag saves on its own.
  const hasChanges = pantryId
    ? name.trim() !== pantry?.name ||
      description.trim() !== (pantry.description ?? '')
    : undefined;

  const onValid = (values: PantrySettingsFormValues) => {
    if (!selectedHomeId) {
      alertService.alert(t('labels.error'), t('errors.noHomeSelected'));
      return;
    }

    void executeWithLoadingState(
      async () => {
        if (!pantryId) {
          const outcome = await createPantry({
            homeId: selectedHomeId,
            name: values.name,
            description:
              values.description || t('pantrySettings.userCreatedDescription'),
            isDefault: values.isDefault,
            tags: ['user-created'],
          });
          if (outcome.status === 'rejected') return;
          // Online echoes the same id, queued replays keyed by it — select and
          // leave either way.
          setSelectedPantryId(outcome.id);
          goBack();
        } else {
          await savePantryFields(pantryId, {
            name: values.name,
            description: values.description,
          });
        }
      },
      setSaving,
      () => {
        alertService.alert(
          t('labels.error'),
          pantryId
            ? t('errors.saveSettingsFailed')
            : t('errors.createPantryFailed'),
        );
      },
    );
  };

  const handleDelete = () => {
    if (!pantryId) return;

    alertService.alert(
      pantry?.name
        ? t('labels.deleteNamed', { name: pantry.name })
        : t('labels.deletePantry'),
      t('pantrySettings.deleteConfirmMessage'),
      destructiveConfirm(t('labels.delete'), () => {
        // Stops the subscription racing the delete.
        subscriptionService.registerParentDeletion(pantryId);

        void executeAsyncWithCleanup(
          async () => {
            const outcome = await deletePantry(pantryId);
            if (outcome.status === 'rejected') return;
            setSelectedPantryId(null);
            goBack();
          },
          () => {
            subscriptionService.unregisterParentDeletion(pantryId);
          },
        );
      }),
    );
  };

  // `loading && !pantry` — a cached copy renders instead of blanking the screen.
  if (pantryId && loadingPantry && !pantry) {
    return (
      <SubScreen title={t('loading.loading')} scroll="none">
        <Loading message={t('pantrySettings.loadingData')} />
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title={
        !pantryId ? t('pantrySettings.createTitle') : t('pantrySettings.title')
      }
      actions={
        (!pantryId ? permissions.canCreatePantry : permissions.canEditItems)
          ? [
              {
                label: saving
                  ? t('labels.saving')
                  : !pantryId
                  ? t('labels.create')
                  : t('labels.save'),
                onPress: () => {
                  void handleSubmit(onValid, reportValidationErrors)();
                },
                variant: 'primary',
                hasChanges,
                disabled: saving,
              },
            ]
          : undefined
      }
      scroll="form"
    >
      <View style={commonStyles.settingsSection}>
        <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
          {t('labels.general')}
        </Text>

        <Controller
          control={control}
          name="name"
          render={({ field, fieldState }) => (
            <BaseInput
              ref={field.ref}
              label={t('labels.pantryName')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              errorMessage={fieldState.error?.message}
              placeholder={t('pantrySettings.namePlaceholder')}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <BaseInput
              ref={field.ref}
              label={t('storageLocationForm.descriptionLabel')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('pantrySettings.descriptionPlaceholder')}
              maxLength={MAX_PANTRY_DESCRIPTION_LENGTH}
              multiline
              numberOfLines={3}
            />
          )}
        />

        <View style={commonStyles.settingsRow}>
          <View style={commonStyles.settingsRowInfo}>
            <Text role="bodyStrong">{t('pantrySettings.defaultPantry')}</Text>
            <Text role="caption" style={commonStyles.settingsRowDescription}>
              {t('pantrySettings.defaultPantryDesc')}
            </Text>
          </View>
          <Controller
            control={control}
            name="isDefault"
            render={({ field }) => (
              <BaseSwitch
                accessibilityLabel={t('pantrySettings.defaultPantry')}
                value={field.value}
                onValueChange={handleToggleDefault}
              />
            )}
          />
        </View>
      </View>

      {!!pantryId && !!pantry && (
        <View style={commonStyles.settingsSection}>
          <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
            {t('labels.information')}
          </Text>

          <InfoRow
            label={t('pantrySettings.itemsInPantry')}
            value={t('labels.itemCount', {
              count: pantryItemCount,
            })}
          />
        </View>
      )}

      {/* Only show danger zone if editing existing pantry and user can delete */}
      {!!pantryId && permissions.canDeletePantry ? (
        <View style={commonStyles.settingsSection}>
          <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
            {t('labels.dangerZone')}
          </Text>

          <AppPressable style={styles.deleteButton} onPress={handleDelete}>
            <Icon name="trash-outline" size="sm" tone="error" />
            <Text
              role="bodyStrong"
              tone="danger"
              style={styles.deleteButtonText}
            >
              {t('labels.deletePantry')}
            </Text>
          </AppPressable>

          <Text role="caption" tone="secondary" style={styles.dangerWarning}>
            {t('pantrySettings.deleteWarning')}
          </Text>
        </View>
      ) : null}
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.base,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.error,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.base,
  },
  deleteButtonText: {
    marginLeft: theme.spacing.sm,
  },
  dangerWarning: {
    fontStyle: 'italic',
  },
}));
