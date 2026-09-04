import React from 'react';
import { View, ScrollView } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { Icon } from '#utils/iconUtils';
import { useTranslation } from '#/i18n';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { BaseInput } from '#components/molecules/BaseInput/BaseInput';
import { commonStyles } from '#/styles/commonStyles';
import { InfoRow } from '#components/atoms/InfoRow';
import { OfflineGate } from '#features/shoppingList/components/OfflineGate';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { RecurringPattern } from '#/graphql/generated/schemaTypes';

import {} from '#features/shoppingList/utils/ownershipHelpers';

import type { StaticScreenProps } from '@react-navigation/native';
import { Text } from '#components/atoms/Text';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {} from '#/utils/formatters/number';
import { useListSettings } from '#features/shoppingList/hooks/useListSettings';
import { listSettingsStyles as styles } from '#features/shoppingList/components/listSettings/styles';
import { BudgetSection } from '#features/shoppingList/components/listSettings/BudgetSection';
import { ListStatusSection } from '#features/shoppingList/components/listSettings/ListStatusSection';
import { RecurringSection } from '#features/shoppingList/components/listSettings/RecurringSection';
import { ReminderSection } from '#features/shoppingList/components/listSettings/ReminderSection';
import { TemplateSection } from '#features/shoppingList/components/listSettings/TemplateSection';
import { Screen } from '#components/templates/Screen';

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
  const { toShareList, toHomeDetail, goBack } = useAppNavigation();
  const {
    basedOnTemplate,
    budgetInput,
    collaborators,
    completedShopDate,
    completing,
    creating,
    currency,
    estimatedTotal,
    formatDate,
    generating,
    handleArchiveToggle,
    handleClearReminder,
    handleCreateFromTemplate,
    handleDelete,
    handleGenerateNext,
    handleLeaveList,
    handleOpenHomePicker,
    handleSave,
    handleSaveAsTemplate,
    handleSelectPattern,
    handleSelectTemplate,
    handleSetReminderDate,
    handleStopRecurring,
    handleToggleComplete,
    handleTogglePriceTracking,
    homes,
    isArchived,
    isCompleted,
    isDefault,
    isHomeMember,
    isOwner,
    isRecurring,
    isShared,
    isTemplate,
    leaving,
    linkedHomeId,
    listId,
    marking,
    name,
    nextRecurringDate,
    ownerInfo,
    patternLabel,
    priceTracking,
    reactivating,
    recurringPattern,
    reminderDate,
    reminderEnabled,
    roleDisplay,
    saving,
    selectedHomeId,
    selectedTemplate,
    selectedTemplateId,
    setBudgetInput,
    setIsDefault,
    setName,
    setSelectedHomeId,
    setShowHomePicker,
    setShowPatternPicker,
    setShowTemplatePicker,
    shoppingList,
    showHomePicker,
    showPatternPicker,
    showTemplatePicker,
    statusDisplay,
    templateName,
    templates,
    totalCost,
  } = useListSettings(route.params?.listId);

  return (
    <Screen
      header={{
        title: !listId
          ? t('shoppingListScreens.createNewList')
          : isOwner
          ? t('shoppingListScreens.listSettings')
          : t('shoppingListScreens.listInfo'),
        back: goBack,
        rightElement: isOwner ? (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text role="bodyStrong" tone="accent">
              {saving
                ? t('labels.saving')
                : !listId
                ? t('labels.create')
                : t('labels.save')}
            </Text>
          </Pressable>
        ) : undefined,
      }}
      scroll="list"
      gutter="none"
    >
      <ScrollView style={styles.content}>
        {!isOwner && listId ? (
          <>
            {/* Read-only view for collaborators */}
            <View style={commonStyles.settingsSection}>
              <Text style={commonStyles.settingsSectionTitle}>
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
                  value={
                    ownerInfo.displayName ||
                    ownerInfo.email ||
                    t('labels.unknown')
                  }
                />
              )}

              {!!isShared && (
                <InfoRow
                  label={t('shoppingListScreens.sharedWith')}
                  value={t('shoppingListScreens.membersCount', {
                    count: collaborators.length,
                  })}
                />
              )}
            </View>

            <View style={commonStyles.settingsSection}>
              <Text style={commonStyles.settingsSectionTitle}>
                {t('labels.leaveList')}
              </Text>

              {isHomeMember ? (
                <>
                  <View style={styles.disabledLeaveButton}>
                    <Icon
                      name="log-out-outline"
                      size={20}
                      tone="textSecondary"
                    />
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
                      <Icon name="people-outline" size={20} tone="primary" />
                      <Text tone="accent" style={styles.actionText}>
                        {t('shoppingListScreens.manageHome')}
                      </Text>
                      <Icon
                        name="chevron-forward"
                        size={20}
                        tone="textSecondary"
                      />
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
                    <Icon name="log-out-outline" size={20} tone="error" />
                    <Text
                      role="bodyStrong"
                      tone="error"
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
          </>
        ) : (
          // Editable view for owners
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('labels.general')}
            </Text>

            <BaseInput
              label={t('shoppingListScreens.listName')}
              value={name}
              onChangeText={setName}
              placeholder={t('shoppingListScreens.listNamePlaceholder')}
            />

            {/* Home selector - only show for new lists. A list created from a
                template can't be linked to a home (createFromTemplate takes no
                homeId), so the picker is inert while one is selected rather
                than silently dropping the choice. */}
            {!listId && (
              <View style={commonStyles.settingsInputGroup}>
                <Text style={commonStyles.settingsLabel}>
                  {t('shoppingListScreens.linkToHome')}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerButton,
                    !!selectedTemplate && styles.pickerButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleOpenHomePicker}
                  disabled={!!selectedTemplate}
                >
                  <Text tone={selectedTemplate ? 'secondary' : 'primary'}>
                    {selectedTemplate
                      ? t('shoppingListScreens.personalNoHome')
                      : homes?.find(h => h.id === selectedHomeId)?.name ||
                        t('shoppingListScreens.personalNoHome')}
                  </Text>
                  <Icon name="chevron-down" size={20} tone="textSecondary" />
                </Pressable>
                {!!selectedTemplate && (
                  <Text
                    role="caption"
                    tone="secondary"
                    style={styles.fieldNote}
                  >
                    {t('shoppingListScreens.templateHomeNote')}
                  </Text>
                )}
              </View>
            )}

            <View style={commonStyles.settingsRow}>
              <View style={commonStyles.settingsRowInfo}>
                <Text style={commonStyles.settingsRowLabel}>
                  {t('shoppingListScreens.defaultList')}
                </Text>
                <Text style={commonStyles.settingsRowDescription}>
                  {t('shoppingListScreens.defaultListDesc')}
                </Text>
              </View>
              <BaseSwitch
                accessibilityLabel={t('shoppingListScreens.defaultList')}
                value={isDefault}
                onValueChange={setIsDefault}
              />
            </View>
          </View>
        )}

        {/* Start a new list from a saved template (create mode). Hidden when
            the user has no templates yet — they're created from an existing
            list's settings. */}
        {!listId && templates.length > 0 && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.templateSection')}
            </Text>

            {/* createFromTemplate is online-only — the server mints the new
                list's id, so it can't be queued. */}
            <OfflineGate
              compact
              message={t('shoppingListScreens.templatesOfflineMessage')}
            >
              <View style={commonStyles.settingsInputGroup}>
                <Text style={commonStyles.settingsLabel}>
                  {t('shoppingListScreens.startFromTemplate')}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setShowTemplatePicker(true)}
                >
                  <Text>
                    {selectedTemplate?.displayName ??
                      t('shoppingListScreens.noTemplateBlankList')}
                  </Text>
                  <Icon name="chevron-down" size={20} tone="textSecondary" />
                </Pressable>
                <Text role="caption" tone="secondary" style={styles.fieldNote}>
                  {t('shoppingListScreens.startFromTemplateDesc')}
                </Text>
              </View>
            </OfflineGate>
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
          isOwner={isOwner}
          listId={listId}
          reactivating={reactivating}
          statusDisplay={statusDisplay}
        />

        <RecurringSection
          formatDate={formatDate}
          generating={generating}
          handleGenerateNext={handleGenerateNext}
          handleStopRecurring={handleStopRecurring}
          isOwner={isOwner}
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
          handleCreateFromTemplate={handleCreateFromTemplate}
          handleSaveAsTemplate={handleSaveAsTemplate}
          isOwner={isOwner}
          isTemplate={isTemplate}
          listId={listId}
          marking={marking}
          name={name}
          templateName={templateName}
        />

        <BudgetSection
          budgetInput={budgetInput}
          currency={currency}
          estimatedTotal={estimatedTotal}
          handleTogglePriceTracking={handleTogglePriceTracking}
          isOwner={isOwner}
          listId={listId}
          priceTracking={priceTracking}
          setBudgetInput={setBudgetInput}
          totalCost={totalCost}
        />

        <ReminderSection
          handleClearReminder={handleClearReminder}
          handleSetReminderDate={handleSetReminderDate}
          isOwner={isOwner}
          listId={listId}
          reminderDate={reminderDate}
          reminderEnabled={reminderEnabled}
        />

        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.sharing')}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.actionRow,
                pressed && styles.pressed,
              ]}
              onPress={() => toShareList({ listId: listId! })}
            >
              <Icon name="person-add" size={20} tone="primary" />
              <Text tone="accent" style={styles.actionText}>
                {t('shoppingListScreens.manageMembers')}
              </Text>
              <Icon name="chevron-forward" size={20} tone="textSecondary" />
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

        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('labels.dangerZone')}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.pressed,
              ]}
              onPress={handleDelete}
            >
              <Icon name="trash-outline" size={20} tone="error" />
              <Text
                role="bodyStrong"
                tone="error"
                style={styles.deleteButtonText}
              >
                {t('labels.deleteList')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <ModalPicker
        visible={showHomePicker}
        label={t('shoppingListScreens.selectHome')}
        options={[
          { label: t('shoppingListScreens.personalNoHome'), value: '' },
          ...(homes?.map(home => ({
            label: home.name,
            value: home.id,
          })) || []),
        ]}
        selected={selectedHomeId || ''}
        onSelect={value => {
          setSelectedHomeId(value || null);
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
        selected={selectedTemplateId ?? ''}
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
        selected={recurringPattern ?? ''}
        onSelect={value => handleSelectPattern(value as RecurringPattern)}
        onCancel={() => setShowPatternPicker(false)}
      />
    </Screen>
  );
};
