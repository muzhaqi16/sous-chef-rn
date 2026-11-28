import React from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon } from '#components/atoms/Icon';
import { useTranslation } from '#i18n';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { commonStyles } from '#styles/commonStyles';
import { InfoRow } from '#components/atoms/InfoRow';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { DataStateView } from '#components/organisms/DataStateView';
import { RecurringPattern } from '#graphql/generated/schemaTypes';
import { LIST_NAME_MAX_LENGTH } from '#features/shoppingList/utils/shoppingListConstants';

import type { StaticScreenProps } from '@react-navigation/native';
import { Text } from '#components/atoms/Text';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { useListSettings } from '#features/shoppingList/hooks/useListSettings';
import { listSettingsStyles as styles } from '#features/shoppingList/components/listSettings/styles';
import { ListStatusSection } from '#features/shoppingList/components/listSettings/ListStatusSection';
import { RecurringSection } from '#features/shoppingList/components/listSettings/RecurringSection';
import { ReminderSection } from '#features/shoppingList/components/listSettings/ReminderSection';
import { TemplateSection } from '#features/shoppingList/components/listSettings/TemplateSection';
import { SubScreen } from '#components/templates/SubScreen';
import { reportValidationErrors } from '#utils/validation/common';
import type { ListSettingsValues } from '#features/shoppingList/hooks/listSettings/useListDetailsSection';
import {
  EMPTY_LIST_SETTINGS,
  listSettingsSchema,
} from './listSettingsFormConfig';

export const ListSettings: React.FC<
  StaticScreenProps<
    | {
        listId?: string;
      }
    | undefined
  >
> = ({ route }) => {
  useScreenTransition('ListSettings');
  const { t } = useTranslation();
  const { toShareList, toHomeDetail } = useAppNavigation();
  const {
    listId,
    shoppingList,
    detailsState,
    saving,
    canEdit,
    canDelete,
    formatDate,
    details: {
      save,
      homes,
      homesState,
      retryHomes,
      showHomePicker,
      setShowHomePicker,
      handleOpenHomePicker,
      templates,
      showTemplatePicker,
      setShowTemplatePicker,
      isTemplate,
      templateName,
      basedOnTemplate,
      marking,
      creating,
      handleSaveAsTemplate,
      handleCreateFromTemplate,
    },
    recurrence: {
      isRecurring,
      recurringPattern,
      nextRecurringDate,
      patternLabel,
      showPatternPicker,
      setShowPatternPicker,
      handleSelectPattern,
      handleStopRecurring,
      handleGenerateNext,
      generating,
    },
    reminder: {
      reminderEnabled,
      reminderDate,
      handleSetReminderDate,
      handleClearReminder,
    },
    membership: {
      collaborators,
      isShared,
      ownership,
      isOwner,
      roleDisplay,
      ownerInfo,
      isHomeMember,
      linkedHomeId,
      leaving,
      retryOwnership,
      handleLeaveList,
    },
    archive: {
      statusDisplay,
      isCompleted,
      isArchived,
      completedShopDate,
      completing,
      reactivating,
      handleToggleComplete,
      handleArchiveToggle,
      handleDelete,
    },
  } = useListSettings(route.params?.listId);

  const readValues: ListSettingsValues | undefined =
    listId && shoppingList
      ? {
          name: shoppingList.name,
          isDefault: shoppingList.isDefault,
          homeId: null,
          templateId: null,
        }
      : undefined;
  const { control, handleSubmit, setValue, getValues } =
    useForm<ListSettingsValues>({
      resolver: yupResolver(listSettingsSchema),
      // `values` lands in an effect after the first render, so a list cached
      // at mount seeds the defaults too.
      defaultValues: readValues ?? EMPTY_LIST_SETTINGS,
      // The list as read, whenever it changes; a field the user has touched
      // keeps what they typed.
      values: readValues,
      resetOptions: { keepDirtyValues: true },
      mode: 'onTouched',
    });
  const [name, isDefault, homeId, templateId] = useWatch({
    control,
    name: ['name', 'isDefault', 'homeId', 'templateId'],
  });
  const selectedTemplate = templates.find(tpl => tpl.id === templateId) ?? null;

  // What Save would write differs from the list; a new list has nothing to compare.
  const hasChanges = listId
    ? name.trim() !== shoppingList?.name || isDefault !== shoppingList.isDefault
    : undefined;

  // Picking a template names the new list after it, unless the user typed
  // their own name.
  const handleSelectTemplate = (value: string) => {
    setShowTemplatePicker(false);
    const next = templates.find(tpl => tpl.id === value) ?? null;
    setValue('templateId', next?.id ?? null);
    const typed = getValues('name');
    if (!typed.trim() || typed === selectedTemplate?.displayName) {
      setValue('name', next?.displayName ?? '');
    }
  };

  // Ownership decides the whole screen — its title, its Save action and six
  // sections — so an unresolved answer waits rather than rendering the viewer's
  // read-only version at someone who may edit.
  if (listId && ownership === 'unknown') {
    return (
      <SubScreen
        title={t('shoppingListScreens.listSettings')}
        state={{ value: detailsState, onRetry: retryOwnership }}
      >
        <></>
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title={
        !listId
          ? t('shoppingListScreens.createNewList')
          : canEdit
          ? t('shoppingListScreens.listSettings')
          : t('shoppingListScreens.listInfo')
      }
      actions={
        canEdit
          ? [
              {
                label: saving
                  ? t('labels.saving')
                  : !listId
                  ? t('labels.create')
                  : t('labels.save'),
                onPress: () => {
                  void handleSubmit(save, reportValidationErrors)();
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
      {!canEdit && listId ? (
        <>
          {/* Read-only view for collaborators */}
          <View style={commonStyles.settingsSection}>
            <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.listInformation')}
            </Text>

            <InfoRow label={t('shoppingListScreens.listName')} value={name} />

            <InfoRow
              label={t('shoppingListScreens.yourRole')}
              value={roleDisplay}
            />

            {!!ownerInfo && (
              <InfoRow
                label={t('shoppingListScreens.owner')}
                value={ownerInfo.name ?? t('labels.unknown')}
              />
            )}

            {!!isShared && (
              <InfoRow
                label={t('shoppingListScreens.sharedWith')}
                value={t('labels.memberCount', {
                  count: collaborators.length,
                })}
              />
            )}
          </View>
        </>
      ) : (
        // Editable for anyone the API lets edit the list
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
                label={t('shoppingListScreens.listName')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                errorMessage={fieldState.error?.message}
                placeholder={t('shoppingListScreens.listNamePlaceholder')}
                maxLength={LIST_NAME_MAX_LENGTH}
              />
            )}
          />

          {/* Home selector - only show for new lists. */}
          {!listId && (
            <View style={commonStyles.settingsInputGroup}>
              <Text role="label" style={commonStyles.settingsLabel}>
                {t('shoppingListScreens.linkToHome')}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.pickerButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleOpenHomePicker}
              >
                <Text role="body">
                  {homes.find(h => h.id === homeId)?.name ??
                    t('shoppingListScreens.personalNoHome')}
                </Text>
                <Icon name="chevron-down" size="sm" tone="textSecondary" />
              </Pressable>
            </View>
          )}

          {/* A default is its owner's mark: the API refuses anyone else. */}
          {!!isOwner && (
            <View style={commonStyles.settingsRow}>
              <View style={commonStyles.settingsRowInfo}>
                <Text role="bodyStrong">
                  {t('shoppingListScreens.defaultList')}
                </Text>
                <Text
                  role="caption"
                  style={commonStyles.settingsRowDescription}
                >
                  {t('shoppingListScreens.defaultListDesc')}
                </Text>
              </View>
              <BaseSwitch
                accessibilityLabel={t('shoppingListScreens.defaultList')}
                value={isDefault}
                onValueChange={next => setValue('isDefault', next)}
              />
            </View>
          )}
        </View>
      )}

      {/* Start a new list from a saved template (create mode). Hidden when
            the user has no templates yet — they're created from an existing
            list's settings. */}
      {!listId && templates.length > 0 && (
        <View style={commonStyles.settingsSection}>
          <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
            {t('shoppingListScreens.templateSection')}
          </Text>

          <View style={commonStyles.settingsInputGroup}>
            <Text role="label" style={commonStyles.settingsLabel}>
              {t('shoppingListScreens.startFromTemplate')}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.pickerButton,
                pressed && styles.pressed,
              ]}
              onPress={() => setShowTemplatePicker(true)}
            >
              <Text role="body">
                {selectedTemplate?.displayName ??
                  t('shoppingListScreens.noTemplateBlankList')}
              </Text>
              <Icon name="chevron-down" size="sm" tone="textSecondary" />
            </Pressable>
            <Text role="caption" tone="secondary" style={styles.fieldNote}>
              {t('shoppingListScreens.startFromTemplateDesc')}
            </Text>
          </View>
        </View>
      )}

      <ListStatusSection
        completedShopDate={completedShopDate}
        completing={completing}
        formatDate={formatDate}
        handleArchiveToggle={handleArchiveToggle}
        handleToggleComplete={handleToggleComplete}
        isArchived={isArchived}
        isCompleted={isCompleted}
        canEdit={canEdit}
        listId={listId}
        reactivating={reactivating}
        statusDisplay={statusDisplay}
      />

      <RecurringSection
        formatDate={formatDate}
        generating={generating}
        handleGenerateNext={handleGenerateNext}
        handleStopRecurring={handleStopRecurring}
        canEdit={canEdit}
        isRecurring={isRecurring}
        listId={listId}
        nextRecurringDate={nextRecurringDate}
        patternLabel={patternLabel}
        recurringPattern={recurringPattern}
        setShowPatternPicker={setShowPatternPicker}
      />

      <TemplateSection
        basedOnTemplate={basedOnTemplate}
        creating={creating}
        handleCreateFromTemplate={() =>
          handleCreateFromTemplate(getValues('name'))
        }
        handleSaveAsTemplate={() => handleSaveAsTemplate(getValues('name'))}
        canEdit={canEdit}
        isTemplate={isTemplate}
        listId={listId}
        marking={marking}
        name={name}
        templateName={templateName}
      />

      <ReminderSection
        handleClearReminder={handleClearReminder}
        handleSetReminderDate={handleSetReminderDate}
        canEdit={canEdit}
        listId={listId}
        reminderDate={reminderDate}
        reminderEnabled={reminderEnabled}
      />

      {!!listId && !!isOwner && (
        <View style={commonStyles.settingsSection}>
          <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
            {t('shoppingListScreens.sharing')}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.pressed,
            ]}
            onPress={() => toShareList({ listId: listId })}
          >
            <Icon name="person-add" size="sm" tone="primary" />
            <Text role="body" tone="accent" style={styles.actionText}>
              {t('shoppingListScreens.manageMembers')}
            </Text>
            <Icon name="chevron-forward" size="sm" tone="textSecondary" />
          </Pressable>

          {!!isShared && (
            <Text role="caption" tone="secondary" style={styles.sharedInfo}>
              {t('shoppingListScreens.sharedWithMembers', {
                count: collaborators.length,
              })}
            </Text>
          )}
        </View>
      )}

      {!!listId && !isOwner && (
        <View style={commonStyles.settingsSection}>
          <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
            {t('labels.leaveList')}
          </Text>

          {isHomeMember ? (
            <>
              <View style={styles.disabledLeaveButton}>
                <Icon name="log-out-outline" size="sm" tone="textSecondary" />
                <Text
                  role="bodyStrong"
                  tone="secondary"
                  style={styles.disabledButtonText}
                >
                  {t('labels.leaveList')}
                </Text>
              </View>
              <Text
                role="caption"
                tone="secondary"
                style={styles.leaveDescription}
              >
                {t('shoppingListScreens.cantLeaveHomeLinkedMessage', {
                  name: shoppingList?.home?.name ?? '',
                })}
              </Text>
              {!!linkedHomeId && (
                <Pressable
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => toHomeDetail({ homeId: linkedHomeId })}
                >
                  <Icon name="people-outline" size="sm" tone="primary" />
                  <Text role="body" tone="accent" style={styles.actionText}>
                    {t('shoppingListScreens.manageHome')}
                  </Text>
                  <Icon name="chevron-forward" size="sm" tone="textSecondary" />
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleLeaveList}
                disabled={leaving}
              >
                <Icon name="log-out-outline" size="sm" tone="error" />
                <Text
                  role="bodyStrong"
                  tone="danger"
                  style={styles.deleteButtonText}
                >
                  {leaving
                    ? t('shoppingListScreens.leaving')
                    : t('labels.leaveList')}
                </Text>
              </Pressable>
              <Text
                role="caption"
                tone="secondary"
                style={styles.leaveDescription}
              >
                {t('shoppingListScreens.leaveDescription')}
              </Text>
            </>
          )}
        </View>
      )}

      {!!listId && !!canDelete && (
        <View style={commonStyles.settingsSection}>
          <Text role="bodyStrong" style={commonStyles.settingsSectionTitle}>
            {t('labels.dangerZone')}
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.pressed,
            ]}
            onPress={handleDelete}
          >
            <Icon name="trash-outline" size="sm" tone="error" />
            <Text
              role="bodyStrong"
              tone="danger"
              style={styles.deleteButtonText}
            >
              {t('labels.deleteList')}
            </Text>
          </Pressable>
        </View>
      )}

      <ModalPicker
        visible={showHomePicker}
        label={t('shoppingListScreens.selectHome')}
        options={[
          { label: t('shoppingListScreens.personalNoHome'), value: '' },
          ...homes.map(home => ({
            label: home.name,
            value: home.id,
          })),
        ]}
        unavailable={
          homesState === 'error' || homesState === 'offline' ? (
            <DataStateView state={homesState} onRetry={retryHomes} />
          ) : undefined
        }
        selected={homeId ?? ''}
        onSelect={value => {
          setValue('homeId', value || null);
          setShowHomePicker(false);
        }}
        onCancel={() => setShowHomePicker(false)}
      />

      <ModalPicker
        visible={showTemplatePicker}
        label={t('shoppingListScreens.selectTemplate')}
        options={[
          { label: t('shoppingListScreens.noTemplateBlankList'), value: '' },
          ...templates.map(tpl => ({
            label: tpl.displayName,
            value: tpl.id,
          })),
        ]}
        selected={templateId ?? ''}
        onSelect={handleSelectTemplate}
        onCancel={() => setShowTemplatePicker(false)}
      />

      <ModalPicker
        visible={showPatternPicker}
        label={t('shoppingListScreens.selectPattern')}
        options={[
          {
            label: t('shoppingListScreens.patternDaily'),
            value: RecurringPattern.Daily,
          },
          {
            label: t('shoppingListScreens.patternWeekly'),
            value: RecurringPattern.Weekly,
          },
          {
            label: t('shoppingListScreens.patternBiweekly'),
            value: RecurringPattern.Biweekly,
          },
          {
            label: t('shoppingListScreens.patternMonthly'),
            value: RecurringPattern.Monthly,
          },
        ]}
        selected={recurringPattern}
        onSelect={handleSelectPattern}
        onCancel={() => setShowPatternPicker(false)}
      />
    </SubScreen>
  );
};
