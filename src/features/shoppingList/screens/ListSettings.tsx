import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { useTranslation } from '#/i18n';
import { BaseSwitch } from '#components/atoms/BaseSwitch';
import { BaseInput } from '#components/atoms/BaseInput/BaseInput';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { ScreenHeader } from '#components/molecules/ScreenHeader';
import { InfoRow } from '#components/molecules/InfoRow';
import { DatePickerField } from '#components/molecules/DatePickerField';
import { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import { useShoppingListTemplates } from '#features/shoppingList/hooks/useShoppingListTemplates';
import { OfflineGate } from '#components/atoms/OfflineGate';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useLazyHomeData } from '#features/home/hooks/useLazyHomeData';
import { ModalPicker } from '#components/molecules/ModalPicker';
import { useLeaveShoppingList } from '#features/shoppingList/hooks/useLeaveShoppingList';
import { useUpdateShoppingList } from '#features/shoppingList/hooks/mutations/useUpdateShoppingList';
import { useCompleteShoppingList } from '#features/shoppingList/hooks/mutations/useCompleteShoppingList';
import { useSetDefaultShoppingList } from '#features/shoppingList/hooks/mutations/useSetDefaultShoppingList';
import { useRecurringShoppingList } from '#features/shoppingList/hooks/mutations/useRecurringShoppingList';
import { useShoppingListTemplate } from '#features/shoppingList/hooks/mutations/useShoppingListTemplate';
import { useShoppingListReminder } from '#features/shoppingList/hooks/mutations/useShoppingListReminder';
import { useShoppingListBudget } from '#features/shoppingList/hooks/mutations/useShoppingListBudget';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { useDeleteShoppingList } from '#features/shoppingList/hooks/mutations/useDeleteShoppingList';
import { ListStatus, RecurringPattern } from '#/graphql/generated/schemaTypes';
import { useAppStore } from '#store/useAppStore';

import { useUser } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  isShoppingListOwner,
  getShoppingListRole,
  formatRoleDisplay,
  getShoppingListOwnerInfo,
} from '#utils/ownershipHelpers';

import type { StaticScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Text } from '#components/atoms/Text';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  formatCurrency,
  formatNumberForInput,
} from '#/utils/formatters/number';
import { formatMonthDayYear } from '#/utils/formatters/date';

function syncListFormState(
  shoppingList:
    | { name: string; isDefault: boolean; budgetAmount?: number | null }
    | null
    | undefined,
  listId: string | undefined,
  setName: (v: string) => void,
  setIsDefault: (v: boolean) => void,
  setBudgetInput: (v: string) => void,
) {
  if (shoppingList && listId) {
    setName(shoppingList.name);
    setIsDefault(shoppingList.isDefault);
    setBudgetInput(formatNumberForInput(shoppingList.budgetAmount));
  } else if (listId) {
    setName('');
    setIsDefault(false);
    setBudgetInput('');
  }
}

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
  const listId = route.params?.listId;
  const { toShareList, toHomeDetail, goBack } = useAppNavigation();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [showHomePicker, setShowHomePicker] = useState(false);
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  // Create mode only: the saved template the new list is copied from.
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const { shoppingList, isShared, collaborators, ownerships } =
    useShoppingListDetails(listId);
  // Only the create screen offers "start from template"; an existing list's
  // settings shouldn't pay for the request.
  const { templates } = useShoppingListTemplates({ skip: !!listId });
  const selectedTemplate =
    templates.find(tpl => tpl.id === selectedTemplateId) ?? null;
  const user = useUser();
  // Lazy: eager home data writes to the Zustand store and re-renders
  // ShoppingListMain.
  const { homes, fetchHomeData, isLoaded: homesLoaded } = useLazyHomeData();

  // ownerships + collaborators are materialized in the hook so the helpers
  // (typed against structural shapes) accept them via a synthesized arg.
  const ownershipSnapshot = shoppingList
    ? {
        ownerships,
        collaboratorsConnection: {
          edges: collaborators.map(n => ({ node: n })),
        },
      }
    : null;

  const isOwner =
    listId && ownershipSnapshot
      ? isShoppingListOwner(ownershipSnapshot, user?.id)
      : true; // For new lists, user is always the owner
  const role = ownershipSnapshot
    ? getShoppingListRole(
        ownershipSnapshot,
        user?.id,
        shoppingList?.home?.myMembership,
      )
    : null;
  const roleDisplay = formatRoleDisplay(role);
  const ownerInfo = ownershipSnapshot
    ? getShoppingListOwnerInfo(ownershipSnapshot)
    : null;

  // The email arm is guarded: both sides are nullable, and null-to-null would
  // match an arbitrary collaborator as "me".
  const currentUserCollaborator = collaborators.find(
    c =>
      (!!user?.email && c.email === user.email) ||
      c.collaboratorId === user?.id,
  );
  // Only a home MEMBER is told to "leave the home first". A direct collaborator
  // on a since-linked list has an orphaned row and must be able to leave the
  // list itself — gating on homeId alone dead-ends them.
  const isHomeMember = !!shoppingList?.home?.myMembership;
  const linkedHomeId = shoppingList?.homeId ?? null;

  const { leaveList, leaving } = useLeaveShoppingList(listId || '');
  const { updateShoppingList } = useUpdateShoppingList(
    t('errors.saveSettingsFailed'),
  );
  const { completeList, reactivateList, completing, reactivating } =
    useCompleteShoppingList();
  const { setAsDefault } = useSetDefaultShoppingList();
  const { setRecurring, cancelRecurring, generateNext, generating } =
    useRecurringShoppingList();
  const { markAsTemplate, createFromTemplate, marking, creating } =
    useShoppingListTemplate();
  const { setReminder, clearReminder } = useShoppingListReminder();
  const { setBudget, setPriceTracking } = useShoppingListBudget();
  const { deleteShoppingList } = useDeleteShoppingList();
  const { createShoppingList } = useCreateShoppingList(
    t('errors.createListFailed'),
  );

  // Lifecycle status is read straight off the list (server-truth), not derived
  // from item counts.
  const status = shoppingList?.status ?? ListStatus.Active;
  const isCompleted =
    shoppingList?.isCompleted ?? status === ListStatus.Completed;
  const isArchived = status === ListStatus.Archived;
  const completedShopDate = shoppingList?.completedShopDate ?? null;
  const statusDisplay =
    status === ListStatus.Completed
      ? t('shoppingListScreens.listStatusCompleted')
      : status === ListStatus.Archived
      ? t('shoppingListScreens.listStatusArchived')
      : status === ListStatus.Paused
      ? t('shoppingListScreens.listStatusPaused')
      : status === ListStatus.Cancelled
      ? t('shoppingListScreens.listStatusCancelled')
      : status === ListStatus.Template
      ? t('shoppingListScreens.listStatusTemplate')
      : t('shoppingListScreens.listStatusActive');

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return t('labels.never');
    return formatMonthDayYear(new Date(dateString));
  };

  const currency = shoppingList?.currency ?? null;
  const totalCost = shoppingList?.totalCost ?? 0;
  const estimatedTotal = shoppingList?.estimatedTotal ?? 0;
  const priceTracking = shoppingList?.priceTracking ?? false;

  const reminderEnabled = shoppingList?.reminderEnabled ?? false;
  const reminderDate = shoppingList?.reminderDate ?? null;

  const isTemplate = shoppingList?.isTemplate ?? false;
  const templateName = shoppingList?.templateName ?? null;
  const basedOnTemplate = shoppingList?.basedOnTemplate ?? null;

  const isRecurring = shoppingList?.isRecurring ?? false;
  const recurringPattern = shoppingList?.recurringPattern ?? null;
  const nextRecurringDate = shoppingList?.nextRecurringDate ?? null;
  const patternLabel = (pattern: RecurringPattern | null): string => {
    switch (pattern) {
      case RecurringPattern.Daily:
        return t('shoppingListScreens.patternDaily');
      case RecurringPattern.Weekly:
        return t('shoppingListScreens.patternWeekly');
      case RecurringPattern.Biweekly:
        return t('shoppingListScreens.patternBiweekly');
      case RecurringPattern.Monthly:
        return t('shoppingListScreens.patternMonthly');
      case RecurringPattern.Custom:
        return t('shoppingListScreens.patternCustom');
      default:
        return t('shoppingListScreens.patternNone');
    }
  };

  useEffect(() => {
    syncListFormState(
      shoppingList,
      listId,
      setName,
      setIsDefault,
      setBudgetInput,
    );
  }, [shoppingList, listId]);

  // A non-owner reaches a home-linked list through their home membership, and
  // leaving the home evicts only the Home from cache — the ShoppingList entity
  // stays. So on focus with every access path gone, pop back and clear the
  // selection, or the user lands on a list they cannot open.
  const hasLostListAccess =
    !!listId &&
    !!shoppingList &&
    !isOwner &&
    !currentUserCollaborator &&
    !isHomeMember;

  useFocusEffect(() => {
    if (hasLostListAccess) {
      setSelectedShoppingListId(null);
      goBack();
    }
  });

  const handleSave = () => {
    if (!name.trim()) {
      toastService.error(t('errors.listNameEmpty'));
      return;
    }

    executeWithLoadingState(
      async () => {
        if (!listId && selectedTemplateId) {
          // The server copies the template's items and mints the id, so this
          // cannot be queued offline and takes no homeId. The default flag
          // still rides on its own mutation afterwards.
          const newListId = await createFromTemplate(
            selectedTemplateId,
            name.trim(),
          );
          if (!newListId) return;
          if (isDefault) {
            await setAsDefault(newListId);
          }
          setSelectedShoppingListId(newListId);
          goBack();
        } else if (!listId) {
          const newList = await createShoppingList({
            name: name.trim(),
            description: t('shoppingListScreens.createdFromSettings'),
            isDefault,
            tags: ['user-created'],
            homeId: selectedHomeId || undefined,
          });
          setSelectedShoppingListId(newList.id);
          goBack();
        } else {
          // Local-first: a queued offline save keeps its cache write and
          // replays on reconnect. Turning the default ON goes through the
          // dedicated mutation, which unsets the prior default atomically.
          const defaultTurnedOn = isDefault && !shoppingList?.isDefault;
          const defaultTurnedOff = !isDefault && !!shoppingList?.isDefault;
          if (defaultTurnedOn) {
            await setAsDefault(listId!);
          }
          await updateShoppingList(listId!, {
            name: name.trim(),
            ...(defaultTurnedOff && { isDefault: false }),
          });

          // Commit a changed budget limit (empty clears it). Ignore a
          // non-numeric entry rather than sending NaN.
          const savedBudget =
            shoppingList?.budgetAmount != null
              ? String(shoppingList.budgetAmount)
              : '';
          if (budgetInput.trim() !== savedBudget) {
            const parsed =
              budgetInput.trim() === '' ? null : Number(budgetInput);
            if (parsed === null || !Number.isNaN(parsed)) {
              await setBudget(listId!, parsed, currency ?? undefined);
            }
          }
        }
      },
      setSaving,
      () => {
        toastService.error(
          listId
            ? t('errors.saveSettingsFailed')
            : t('errors.createListFailed'),
        );
      },
    );
  };

  const handleDelete = () => {
    if (!listId) return; // Should never happen as delete button is hidden
    alertService.alert(
      t('labels.deleteList'),
      t('shoppingListScreens.deleteListConfirmMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.delete'),
          style: 'destructive',
          onPress: async () => {
            // Suppresses subscription races; the service auto-cleans after 10s.
            subscriptionService.registerParentDeletion(listId);

            try {
              await deleteShoppingList(listId!);

              // useShoppingListSelection then auto-selects the next list.
              setSelectedShoppingListId(null);
              // Unmounts this screen's query watcher, so a late subscription
              // update cannot trigger a refetch of the deleted list.
              goBack();
            } catch {
              subscriptionService.unregisterParentDeletion(listId);
            }
          },
        },
      ],
    );
  };

  // Complete / reactivate — the hook owns its own failure alert + optimistic
  // revert, so we just fire the right direction.
  const handleToggleComplete = () => {
    if (!listId) return;
    if (isCompleted) {
      reactivateList(listId);
    } else {
      completeList(listId);
    }
  };

  const archiveList = async () => {
    if (!listId) return;
    try {
      await updateShoppingList(listId, { status: ListStatus.Archived });
    } catch {
      toastService.error(t('shoppingListScreens.failedToArchive'));
    }
  };

  const handleArchiveToggle = async () => {
    if (!listId) return;
    if (isArchived) {
      // Restoring is non-destructive — flip straight back to active.
      try {
        await updateShoppingList(listId, { status: ListStatus.Active });
      } catch {
        toastService.error(t('shoppingListScreens.failedToArchive'));
      }
      return;
    }
    // Archiving hides the list from the active view — confirm first.
    alertService.alert(
      t('labels.archiveList'),
      t('shoppingListScreens.archiveListConfirmMessage'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.archiveList'),
          onPress: archiveList,
        },
      ],
    );
  };

  // Price tracking toggles immediately (like a real setting), not on Save.
  const handleTogglePriceTracking = (value: boolean) => {
    if (listId) {
      setPriceTracking(listId, value);
    }
  };

  // Reminder — a picked date sets/updates it; the clear action removes it.
  const handleSetReminderDate = (date: Date | null) => {
    if (listId && date) {
      setReminder(listId, date.toISOString(), true);
    }
  };

  const handleClearReminder = () => {
    if (listId) {
      clearReminder(listId);
    }
  };

  // Templates — save this list as a reusable template (keeps its items), or
  // spin up a new list from it.
  const handleSaveAsTemplate = () => {
    if (listId) {
      markAsTemplate(listId, name.trim() || t('shoppingListScreens.thisList'));
    }
  };

  const handleCreateFromTemplate = () => {
    if (!listId) return;
    executeWithLoadingState(
      async () => {
        const newListId = await createFromTemplate(
          listId,
          name.trim() || undefined,
        );
        if (newListId) {
          setSelectedShoppingListId(newListId);
          goBack();
        }
      },
      setSaving,
      () =>
        toastService.error(t('shoppingListScreens.failedToCreateFromTemplate')),
    );
  };

  // Interval defaults to 1; custom intervals are not exposed here.
  const handleSelectPattern = (pattern: RecurringPattern) => {
    setShowPatternPicker(false);
    if (listId) {
      setRecurring(listId, pattern, 1);
    }
  };

  const handleStopRecurring = () => {
    if (listId) {
      cancelRecurring(listId);
    }
  };

  const handleGenerateNext = () => {
    if (!listId) return;
    executeWithLoadingState(
      async () => {
        const newListId = await generateNext(listId);
        if (newListId) {
          setSelectedShoppingListId(newListId);
          goBack();
        }
      },
      setSaving,
      () => toastService.error(t('shoppingListScreens.failedToGenerateNext')),
    );
  };

  // Picking a template fills the name field with the template's name so the
  // new list is named something recognizable, unless the user typed their own.
  const handleSelectTemplate = (value: string) => {
    setShowTemplatePicker(false);
    const next = templates.find(tpl => tpl.id === value) ?? null;
    setSelectedTemplateId(next?.id ?? null);
    if (!name.trim() || name === selectedTemplate?.displayName) {
      setName(next?.displayName ?? '');
    }
    // The template path can't carry a home, so drop a pending choice rather
    // than keep state the create would silently ignore.
    if (next) {
      setSelectedHomeId(null);
    }
  };

  const handleOpenHomePicker = () => {
    if (!homesLoaded) {
      fetchHomeData();
    }
    setShowHomePicker(true);
  };

  const handleLeaveList = () => {
    alertService.alert(
      t('shoppingListScreens.leaveListTitle'),
      t('shoppingListScreens.leaveListMessage', {
        name: name || t('shoppingListScreens.thisList'),
      }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.leaveList'),
          style: 'destructive',
          onPress: () => {
            if (!currentUserCollaborator?.id) {
              toastService.error(
                t('shoppingListScreens.couldNotDetermineMembership'),
              );
              return;
            }

            leaveList(currentUserCollaborator.id, {
              onSuccess: () => {
                setSelectedShoppingListId(null);
                goBack();
              },
              onError: () =>
                toastService.error(t('shoppingListScreens.failedToLeave')),
            });
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={
          !listId
            ? t('shoppingListScreens.createNewList')
            : isOwner
            ? t('shoppingListScreens.listSettings')
            : t('shoppingListScreens.listInfo')
        }
        onBack={goBack}
        rightElement={
          isOwner ? (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text size="md" weight="semibold" tone="accent">
                {saving
                  ? t('labels.saving')
                  : !listId
                  ? t('labels.create')
                  : t('labels.save')}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

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
                      size="md"
                      weight="semibold"
                      tone="secondary"
                      style={styles.disabledButtonText}
                    >
                      {t('labels.leaveList')}
                    </Text>
                  </View>
                  <Text
                    size="sm"
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
                      <Text size="md" tone="accent" style={styles.actionText}>
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
                      size="md"
                      weight="semibold"
                      tone="error"
                      style={styles.deleteButtonText}
                    >
                      {leaving
                        ? t('shoppingListScreens.leaving')
                        : t('labels.leaveList')}
                    </Text>
                  </Pressable>
                  <Text
                    size="sm"
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
                  <Text
                    size="md"
                    tone={selectedTemplate ? 'secondary' : 'primary'}
                  >
                    {selectedTemplate
                      ? t('shoppingListScreens.personalNoHome')
                      : homes?.find(h => h.id === selectedHomeId)?.name ||
                        t('shoppingListScreens.personalNoHome')}
                  </Text>
                  <Icon name="chevron-down" size={20} tone="textSecondary" />
                </Pressable>
                {!!selectedTemplate && (
                  <Text size="sm" tone="secondary" style={styles.fieldNote}>
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
              <BaseSwitch value={isDefault} onValueChange={setIsDefault} />
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
                  <Text size="md">
                    {selectedTemplate?.displayName ??
                      t('shoppingListScreens.noTemplateBlankList')}
                  </Text>
                  <Icon name="chevron-down" size={20} tone="textSecondary" />
                </Pressable>
                <Text size="sm" tone="secondary" style={styles.fieldNote}>
                  {t('shoppingListScreens.startFromTemplateDesc')}
                </Text>
              </View>
            </OfflineGate>
          </View>
        )}

        {/* List status — complete / reactivate / archive. */}
        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.listStatusSection')}
            </Text>

            <InfoRow label={t('labels.status')} value={statusDisplay} />
            {!!isCompleted && !!completedShopDate && (
              <InfoRow
                label={t('shoppingListScreens.completedOn')}
                value={formatDate(completedShopDate)}
              />
            )}

            {!isArchived && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.pressed,
                ]}
                onPress={handleToggleComplete}
                disabled={completing || reactivating}
              >
                <Icon
                  name={
                    isCompleted ? 'refresh-outline' : 'checkmark-done-outline'
                  }
                  size={20}
                  tone="primary"
                />
                <Text size="md" tone="accent" style={styles.actionText}>
                  {isCompleted
                    ? t('shoppingListScreens.reactivateList')
                    : t('shoppingListScreens.markComplete')}
                </Text>
              </Pressable>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.actionRow,
                pressed && styles.pressed,
              ]}
              onPress={handleArchiveToggle}
            >
              <Icon
                name={isArchived ? 'arrow-undo-outline' : 'archive-outline'}
                size={20}
                tone="primary"
              />
              <Text size="md" tone="accent" style={styles.actionText}>
                {isArchived
                  ? t('shoppingListScreens.restoreList')
                  : t('labels.archiveList')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Recurring — set up / stop auto-regeneration. */}
        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.recurringSection')}
            </Text>

            {isRecurring ? (
              <>
                <InfoRow
                  label={t('shoppingListScreens.recurringPatternLabel')}
                  value={patternLabel(recurringPattern)}
                />
                {!!nextRecurringDate && (
                  <InfoRow
                    label={t('shoppingListScreens.nextOccurrence')}
                    value={formatDate(nextRecurringDate)}
                  />
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleGenerateNext}
                  disabled={generating}
                >
                  <Icon name="add-circle-outline" size={20} tone="primary" />
                  <Text size="md" tone="accent" style={styles.actionText}>
                    {t('shoppingListScreens.generateNextList')}
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleStopRecurring}
                >
                  <Icon name="close-circle-outline" size={20} tone="primary" />
                  <Text size="md" tone="accent" style={styles.actionText}>
                    {t('shoppingListScreens.stopRecurring')}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.pressed,
                ]}
                onPress={() => setShowPatternPicker(true)}
              >
                <Icon name="repeat-outline" size={20} tone="primary" />
                <Text size="md" tone="accent" style={styles.actionText}>
                  {t('shoppingListScreens.makeRecurring')}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Templates — save as / create from a template. */}
        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.templateSection')}
            </Text>

            {!!basedOnTemplate && (
              <InfoRow
                label={t('shoppingListScreens.basedOnTemplate')}
                value={basedOnTemplate.name}
              />
            )}

            {isTemplate ? (
              <>
                <InfoRow
                  label={t('labels.templateName')}
                  value={templateName ?? name}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleCreateFromTemplate}
                  disabled={creating}
                >
                  <Icon name="duplicate-outline" size={20} tone="primary" />
                  <Text size="md" tone="accent" style={styles.actionText}>
                    {t('shoppingListScreens.createFromTemplate')}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.pressed,
                ]}
                onPress={handleSaveAsTemplate}
                disabled={marking}
              >
                <Icon name="bookmark-outline" size={20} tone="primary" />
                <Text size="md" tone="accent" style={styles.actionText}>
                  {t('labels.saveAsTemplate')}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Budget / spend — limit, running totals, price tracking. */}
        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.budgetSection')}
            </Text>

            <InfoRow
              label={t('labels.totalSpent')}
              value={formatCurrency(totalCost, currency)}
            />
            <InfoRow
              label={t('shoppingListScreens.estimatedTotalLabel')}
              value={formatCurrency(estimatedTotal, currency)}
            />

            <BaseInput
              label={t('shoppingListScreens.budgetAmountLabel')}
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="numeric"
              placeholder={t('shoppingListScreens.budgetPlaceholder')}
            />

            <View style={commonStyles.settingsRow}>
              <View style={commonStyles.settingsRowInfo}>
                <Text style={commonStyles.settingsRowLabel}>
                  {t('shoppingListScreens.priceTrackingLabel')}
                </Text>
                <Text style={commonStyles.settingsRowDescription}>
                  {t('shoppingListScreens.priceTrackingDesc')}
                </Text>
              </View>
              <BaseSwitch
                value={priceTracking}
                onValueChange={handleTogglePriceTracking}
              />
            </View>
          </View>
        )}

        {/* Reminder — set / clear a shopping reminder. */}
        {!!listId && !!isOwner && (
          <View style={commonStyles.settingsSection}>
            <Text style={commonStyles.settingsSectionTitle}>
              {t('shoppingListScreens.reminderSection')}
            </Text>

            <DatePickerField
              label={t('shoppingListScreens.reminderDateLabel')}
              value={reminderDate ? new Date(reminderDate) : null}
              onChange={handleSetReminderDate}
              minimumDate={new Date()}
              placeholder={t('shoppingListScreens.setReminderPlaceholder')}
            />

            {!!reminderEnabled && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.pressed,
                ]}
                onPress={handleClearReminder}
              >
                <Icon
                  name="notifications-off-outline"
                  size={20}
                  tone="primary"
                />
                <Text size="md" tone="accent" style={styles.actionText}>
                  {t('shoppingListScreens.clearReminder')}
                </Text>
              </Pressable>
            )}
          </View>
        )}

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
              <Text size="md" tone="accent" style={styles.actionText}>
                {t('shoppingListScreens.manageMembers')}
              </Text>
              <Icon name="chevron-forward" size={20} tone="textSecondary" />
            </Pressable>

            {!!isShared && (
              <Text size="sm" tone="secondary" style={styles.sharedInfo}>
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
                size="md"
                weight="semibold"
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.base,
  },
  actionText: {
    flex: 1,
    marginLeft: theme.spacing.base,
  },
  sharedInfo: {
    marginTop: theme.spacing.sm,
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
  },
  deleteButtonText: {
    marginLeft: theme.spacing.sm,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.smPlus,
    backgroundColor: theme.colors.surface,
  },
  pickerButtonDisabled: {
    opacity: 0.6,
  },
  fieldNote: {
    marginTop: theme.spacing.sm,
  },
  leaveDescription: {
    marginTop: theme.spacing.sm,
  },
  disabledLeaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.base,
    borderWidth: theme.borderWidth.hairline,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    borderColor: theme.colors.border,
    opacity: 0.6,
  },
  disabledButtonText: {
    marginLeft: theme.spacing.sm,
  },
}));
