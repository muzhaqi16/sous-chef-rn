import { useState, useEffect } from 'react';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import { useShoppingListTemplates } from '#features/shoppingList/hooks/useShoppingListTemplates';
import { useNavigationIntents, useScreenFocusEffect } from '#platform/screen';
import { useLazyHomeData } from '#features/home/hooks/useLazyHomeData';
import { useRemoveCollaborator } from '#features/shoppingList/hooks/useRemoveCollaborator';
import { useUpdateShoppingList } from '#features/shoppingList/hooks/mutations/useUpdateShoppingList';
import { useCompleteShoppingList } from '#features/shoppingList/hooks/mutations/useCompleteShoppingList';
import { useSetDefaultShoppingList } from '#features/shoppingList/hooks/mutations/useSetDefaultShoppingList';
import { useRecurringShoppingList } from '#features/shoppingList/hooks/mutations/useRecurringShoppingList';
import { useShoppingListTemplate } from '#features/shoppingList/hooks/mutations/useShoppingListTemplate';
import { useShoppingListReminder } from '#features/shoppingList/hooks/mutations/useShoppingListReminder';
import { useShoppingListBudget } from '#features/shoppingList/hooks/mutations/useShoppingListBudget';
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { useDeleteShoppingList } from '#features/shoppingList/hooks/mutations/useDeleteShoppingList';
import {
  ListStatus,
  PriceComparisonScope,
  RecurringPattern,
} from '#/graphql/generated/schemaTypes';
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

import { formatNumberForInput } from '#/utils/formatters/number';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { formatMonthDayYear } from '#/utils/formatters/date';
import { dayAsInstant } from '#/utils/dateUtils';
import { destructiveConfirm } from '#/services/destructiveConfirm';

/** Whose list this is, with "not yet known" kept distinct from "not yours". */
export type OwnershipAnswer = 'owner' | 'other' | 'unknown';

interface StoreChoice {
  id: string;
  name: string;
}

function syncListFormState(
  shoppingList:
    | {
        name: string;
        isDefault: boolean;
        budgetAmount?: number | null;
        targetStore: StoreChoice | null;
      }
    | null
    | undefined,
  listId: string | undefined,
  setName: (v: string) => void,
  setIsDefault: (v: boolean) => void,
  setBudgetInput: (v: string) => void,
  setStoreInput: (v: string) => void,
  setPickedStore: (store: StoreChoice | null) => void,
) {
  if (shoppingList && listId) {
    setName(shoppingList.name);
    setIsDefault(shoppingList.isDefault);
    setBudgetInput(formatNumberForInput(shoppingList.budgetAmount));
    setStoreInput(shoppingList.targetStore?.name ?? '');
    setPickedStore(shoppingList.targetStore);
  } else if (listId) {
    setName('');
    setIsDefault(false);
    setBudgetInput('');
    setStoreInput('');
    setPickedStore(null);
  }
}

/**
 * Everything the list-settings screen needs that is not markup: the form state,
 * the seven mutation wrappers behind one callback each, and the values derived
 * from the list. The screen was 1,235 lines with this in the middle of it.
 */
export const useListSettings = (listId: string | undefined) => {
  const { t } = useTranslation();
  const { goBack } = useNavigationIntents();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  // What the store field shows, and the store picked from its suggestions: a
  // typed name that is not picked names no store.
  const [storeInput, setStoreInput] = useState('');
  const [pickedStore, setPickedStore] = useState<StoreChoice | null>(null);
  // The comparison on screen, which a change of store restates in its answer.
  const [comparisonScope, setComparisonScope] = useState(
    PriceComparisonScope.Store,
  );
  const [saving, setSaving] = useState(false);
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);
  const [showHomePicker, setShowHomePicker] = useState(false);
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  // Create mode only: the saved template the new list is copied from.
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const {
    shoppingList,
    isShared,
    collaborators,
    ownerships,
    refetch: refetchDetails,
  } = useShoppingListDetails(listId);
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

  // A new list is the author's. For an existing one `unknown` is neither: owner
  // would offer the owner-only controls to a non-owner, and `other` would hide
  // them from the owner with no way to tell why.
  const ownership: OwnershipAnswer = !listId
    ? 'owner'
    : !ownershipSnapshot
    ? 'unknown'
    : isShoppingListOwner(ownershipSnapshot, user?.id)
    ? 'owner'
    : 'other';
  const isOwner = ownership === 'owner';
  const role = ownershipSnapshot
    ? getShoppingListRole(
        ownershipSnapshot,
        user?.id,
        shoppingList?.home?.myMembership,
      )
    : null;
  const roleDisplay = formatRoleDisplay(role, t);
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

  const { leaveList, leaving } = useRemoveCollaborator(listId ?? '');
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
  const { setPriceTracking } = useShoppingListBudget();
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
  // Null is an amount nobody recorded, which is not an amount of zero.
  const totalCost = shoppingList?.totalCost ?? null;
  const estimatedTotal = shoppingList?.estimatedTotal ?? null;
  const unpricedItems = shoppingList?.unpricedItems ?? 0;
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
      case null:
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
      setStoreInput,
      setPickedStore,
    );
  }, [shoppingList, listId]);

  // Leaving a home evicts only the Home, not a home-linked ShoppingList a
  // non-owner reached through it, so with every access path gone this pops back
  // and clears the selection rather than land on a list they cannot open.
  const hasLostListAccess =
    !!listId &&
    !!shoppingList &&
    !isOwner &&
    !currentUserCollaborator &&
    !isHomeMember;

  useScreenFocusEffect(() => {
    if (hasLostListAccess) {
      setSelectedShoppingListId(null);
      goBack();
    }
  });

  const handleStoreSelected = (id: string | null, storeName: string | null) =>
    setPickedStore(id && storeName ? { id, name: storeName } : null);

  const handleSave = () => {
    if (!name.trim()) {
      toastService.error(t('errors.listNameEmpty'));
      return;
    }

    // A changed budget limit (empty clears it); a non-numeric entry is left out
    // rather than sent as NaN. `Number` would read a comma-decimal keypad's
    // entry as NaN, so it is parsed with `parseDecimalInput`.
    const savedBudget =
      shoppingList?.budgetAmount != null
        ? String(shoppingList.budgetAmount)
        : '';
    const typedBudget =
      budgetInput.trim() === '' ? null : parseDecimalInput(budgetInput);
    const changedBudget =
      budgetInput.trim() !== savedBudget && !Number.isNaN(typedBudget)
        ? typedBudget
        : undefined;
    const storeChanged = pickedStore?.id !== shoppingList?.targetStore?.id;

    void executeWithLoadingState(
      async () => {
        if (!listId && selectedTemplateId) {
          // The copy is assembled on the device, so it is queued like any
          // other create and carries the home the user picked. The default
          // flag still rides on its own mutation afterwards.
          const newListId = await createFromTemplate(
            selectedTemplateId,
            name.trim(),
            selectedHomeId ?? undefined,
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
            homeId: selectedHomeId ?? undefined,
          });
          if (newList.status === 'failed') {
            toastService.error(newList.body);
            return;
          }
          setSelectedShoppingListId(newList.shoppingList.id);
          goBack();
        } else {
          // Local-first: a queued offline save keeps its cache write and
          // replays on reconnect. Turning the default ON goes through the
          // dedicated mutation, which unsets the prior default atomically.
          const defaultTurnedOn = isDefault && !shoppingList?.isDefault;
          const defaultTurnedOff = !isDefault && !!shoppingList?.isDefault;
          if (defaultTurnedOn) {
            await setAsDefault(listId);
          }
          await updateShoppingList(
            listId,
            {
              name: name.trim(),
              ...(defaultTurnedOff && { isDefault: false }),
              ...(storeChanged && { targetStore: pickedStore }),
              ...(changedBudget !== undefined && {
                planning: {
                  budgetAmount: changedBudget,
                  ...(currency !== null && { currency }),
                },
              }),
            },
            comparisonScope,
          );
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

  const deleteList = async (id: string) => {
    // Suppresses subscription races; the service auto-cleans after 10s.
    subscriptionService.registerParentDeletion(id);

    // The hook reports a refusal by returning false and has already said so;
    // leaving the screen anyway strands the person on a list that still exists.
    const deleted = await deleteShoppingList(id);
    if (!deleted) {
      subscriptionService.unregisterParentDeletion(id);
      return;
    }

    // useShoppingListSelection then auto-selects the next list.
    setSelectedShoppingListId(null);
    // Unmounts this screen's query watcher, so a late subscription
    // update cannot trigger a refetch of the deleted list.
    goBack();
  };

  const handleDelete = () => {
    if (!listId) return; // Should never happen as delete button is hidden
    alertService.alert(
      t('labels.deleteList'),
      t('shoppingListScreens.deleteListConfirmMessage'),
      destructiveConfirm(t('labels.delete'), () => {
        void deleteList(listId);
      }),
    );
  };

  // Complete / reactivate — the hook owns its own failure alert + optimistic
  // revert, so we just fire the right direction.
  const handleToggleComplete = () => {
    if (!listId) return;
    if (isCompleted) {
      void reactivateList(listId);
    } else {
      void completeList(listId);
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
          onPress: () => {
            void archiveList();
          },
        },
      ],
    );
  };

  // Price tracking toggles immediately (like a real setting), not on Save.
  const handleTogglePriceTracking = (value: boolean) => {
    if (listId) {
      void setPriceTracking(listId, value);
    }
  };

  // Reminder — a picked date sets/updates it; the clear action removes it.
  // The API reads the reminder's day in the owner's recorded time zone.
  const handleSetReminderDate = (date: Date | null) => {
    if (listId && date) {
      void setReminder(listId, dayAsInstant(date), true);
    }
  };

  const handleClearReminder = () => {
    if (listId) {
      void clearReminder(listId);
    }
  };

  // Templates — save this list as a reusable template (keeps its items), or
  // spin up a new list from it.
  const handleSaveAsTemplate = () => {
    if (listId) {
      void markAsTemplate(
        listId,
        name.trim() || t('shoppingListScreens.thisList'),
      );
    }
  };

  const handleCreateFromTemplate = () => {
    if (!listId) return;
    void executeWithLoadingState(
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
      void setRecurring(listId, pattern, 1);
    }
  };

  const handleStopRecurring = () => {
    if (listId) {
      void cancelRecurring(listId);
    }
  };

  const handleGenerateNext = () => {
    if (!listId) return;
    void executeWithLoadingState(
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
      destructiveConfirm(t('labels.leaveList'), () => {
        if (!currentUserCollaborator?.id) {
          toastService.error(
            t('shoppingListScreens.couldNotDetermineMembership'),
          );
          return;
        }

        void leaveList(currentUserCollaborator.id, {
          onSuccess: () => {
            setSelectedShoppingListId(null);
            goBack();
          },
          onError: () =>
            toastService.error(t('shoppingListScreens.failedToLeave')),
        });
      }),
    );
  };

  return {
    basedOnTemplate,
    budgetInput,
    collaborators,
    comparisonScope,
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
    handleStoreSelected,
    handleToggleComplete,
    handleTogglePriceTracking,
    homes,
    isArchived,
    isCompleted,
    isDefault,
    isHomeMember,
    isOwner,
    ownership,
    retryOwnership: () => {
      void refetchDetails();
    },
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
    setComparisonScope,
    setShowHomePicker,
    setShowPatternPicker,
    setShowTemplatePicker,
    setStoreInput,
    shoppingList,
    showHomePicker,
    showPatternPicker,
    showTemplatePicker,
    statusDisplay,
    storeInput,
    templateName,
    templates,
    totalCost,
    unpricedItems,
  };
};
