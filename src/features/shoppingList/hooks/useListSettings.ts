import { useState, useEffect } from 'react';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import { useShoppingListTemplates } from '#features/shoppingList/hooks/useShoppingListTemplates';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useLazyHomeData } from '#features/home/hooks/useLazyHomeData';
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
} from '#features/shoppingList/utils/ownershipHelpers';

import { useFocusEffect } from '@react-navigation/native';
import { formatNumberForInput } from '#/utils/formatters/number';
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

/**
 * Everything the list-settings screen needs that is not markup: the form state,
 * the seven mutation wrappers behind one callback each, and the values derived
 * from the list. The screen was 1,235 lines with this in the middle of it.
 */
export const useListSettings = (listId: string | undefined) => {
  const { t } = useTranslation();
  const { goBack } = useAppNavigation();
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

  return {
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
  };
};
