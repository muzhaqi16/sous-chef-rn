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
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { Text } from '#components/atoms/Text';

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
    setIsDefault(newValue);
    if (!pantryId) return;
    // Put the switch back when the flag did not stick.
    if (!(await setDefault(pantryId))) setIsDefault(!newValue);
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
          const outcome = await createPantry({
            homeId: selectedHomeId,
            name: name.trim(),
            description:
              description.trim() || t('pantrySettings.userCreatedDescription'),
            isDefault,
            tags: ['user-created'],
          });
          if (outcome.status === 'rejected') {
            alertRejectedMutation(
              outcome.result,
              outcome.rejectionMessage ?? t('pantrySettings.createFailed'),
            );
            return;
          }
          // Online echoes the same id, queued replays keyed by it — select and
          // leave either way.
          setSelectedPantryId(outcome.id);
          goBack();
        } else {
          await savePantryFields(pantryId, {
            name: name.trim(),
            description: description.trim(),
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
                const outcome = await deletePantry(pantryId);
                if (outcome.status === 'rejected') {
                  alertRejectedMutation(
                    outcome.result,
                    t('errors.deletePantryFailed'),
                  );
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
