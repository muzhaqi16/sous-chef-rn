import { useState, useRef } from 'react';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import { useDataState } from '#hooks/data/useDataState';
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
import { useCreateShoppingList } from '#features/shoppingList/hooks/useCreateShoppingList';
import { useDeleteShoppingList } from '#features/shoppingList/hooks/mutations/useDeleteShoppingList';
import { ListStatus, RecurringPattern } from '#/graphql/generated/schemaTypes';
import { useAppStore } from '#store/useAppStore';

import { useUser } from '#store/useAppStore';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  listOwnershipOf,
  getShoppingListRole,
  formatRoleDisplay,
  getShoppingListOwnerInfo,
} from '#features/shoppingList/utils/ownershipHelpers';
import { canDeleteShoppingList } from '#features/shoppingList/utils/shoppingListPermissions';
import { useShoppingListPermissions } from '#features/shoppingList/hooks/useShoppingListPermissions';

import { formatMonthDayYear } from '#/utils/formatters/date';
import { dayAsInstant } from '#/utils/dateUtils';
import { destructiveConfirm } from '#/services/destructiveConfirm';

/** What the settings form saves; a new list also takes its home and template. */
export interface ListSettingsValues {
  name: string;
  isDefault: boolean;
  homeId: string | null;
  templateId: string | null;
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
  const [saving, setSaving] = useState(false);
  const [showHomePicker, setShowHomePicker] = useState(false);
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const {
    shoppingList,
    isShared,
    collaborators,
    ownerships,
    loading: detailsLoading,
    hasResult: detailsHeld,
    refetch: refetchDetails,
  } = useShoppingListDetails(listId);
  const detailsState = useDataState({
    loading: detailsLoading,
    hasResult: detailsHeld,
    isEmpty: false,
  });
  // Only the create screen offers "start from template"; an existing list's
  // settings shouldn't pay for the request.
  const { templates } = useShoppingListTemplates({ skip: !!listId });
  const user = useUser();
  // Lazy: eager home data writes to the Zustand store and re-renders
  // ShoppingListMain.
  const {
    homes,
    state: homesState,
    fetchHomeData,
    isLoaded: homesLoaded,
  } = useLazyHomeData();

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

  const ownership = listOwnershipOf(listId, ownershipSnapshot, user?.id);
  const isOwner = ownership === 'owner';
  // The API's EDIT, which every section but the default and sharing takes:
  // the owner, a home's MEMBER and above, a collaborator holding canEdit.
  const permissions = useShoppingListPermissions(shoppingList, user?.id);
  const canEdit = isOwner || permissions.canEditList;
  const canDelete = canDeleteShoppingList(
    isOwner,
    shoppingList?.home?.myMembership?.role,
  );
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

  // The list is gone for this person: deleted or left here, or every access
  // path lost elsewhere. A delete or leave also loses access once it lands, so
  // the screen is left once, whichever notices first.
  const leftList = useRef(false);
  const leaveGoneList = () => {
    if (leftList.current) return;
    leftList.current = true;
    setSelectedShoppingListId(null);
    goBack();
  };

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
    if (hasLostListAccess) leaveGoneList();
  });

  const save = ({ name, isDefault, homeId, templateId }: ListSettingsValues) =>
    executeWithLoadingState(
      async () => {
        if (!listId && templateId) {
          // The copy is assembled on the device, so it is queued like any
          // other create and carries the home the user picked. The default
          // flag still rides on its own mutation afterwards.
          const newListId = await createFromTemplate(
            templateId,
            name,
            homeId ?? undefined,
          );
          if (!newListId) return;
          if (isDefault) {
            await setAsDefault(newListId);
          }
          setSelectedShoppingListId(newListId);
          goBack();
        } else if (!listId) {
          const newList = await createShoppingList({
            name,
            description: t('shoppingListScreens.createdFromSettings'),
            isDefault,
            tags: ['user-created'],
            homeId: homeId ?? undefined,
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
          await updateShoppingList(listId, {
            name,
            ...(defaultTurnedOff && { isDefault: false }),
          });
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

    // useShoppingListSelection then auto-selects the next list; leaving
    // unmounts this screen's query watcher, so a late subscription update
    // cannot trigger a refetch of the deleted list.
    leaveGoneList();
  };

  const handleDelete = () => {
    if (!listId) return; // Should never happen as delete button is hidden
    alertService.alert(
      t('labels.deleteList'),
      t('shoppingListSelector.deleteAlertMessage', { count: 1 }),
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
  // Both take the name as typed, saved or not.
  const handleSaveAsTemplate = (name: string) => {
    if (listId) {
      void markAsTemplate(
        listId,
        name.trim() || t('shoppingListScreens.thisList'),
      );
    }
  };

  const handleCreateFromTemplate = (name: string) => {
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
        name: shoppingList?.name ?? t('shoppingListScreens.thisList'),
      }),
      destructiveConfirm(t('labels.leaveList'), () => {
        if (!currentUserCollaborator?.id) {
          toastService.error(
            t('shoppingListScreens.couldNotDetermineMembership'),
          );
          return;
        }

        void leaveList(currentUserCollaborator.id, {
          onSuccess: leaveGoneList,
          onError: () =>
            toastService.error(t('shoppingListScreens.failedToLeave')),
        });
      }),
    );
  };

  return {
    basedOnTemplate,
    collaborators,
    completedShopDate,
    completing,
    creating,
    formatDate,
    generating,
    handleArchiveToggle,
    handleClearReminder,
    handleCreateFromTemplate,
    canDelete,
    canEdit,
    handleDelete,
    handleGenerateNext,
    handleLeaveList,
    handleOpenHomePicker,
    handleSaveAsTemplate,
    handleSelectPattern,
    handleSetReminderDate,
    handleStopRecurring,
    handleToggleComplete,
    homes,
    homesState,
    retryHomes: fetchHomeData,
    isArchived,
    isCompleted,
    isHomeMember,
    isOwner,
    ownership,
    detailsState,
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
    nextRecurringDate,
    ownerInfo,
    patternLabel,
    reactivating,
    recurringPattern,
    reminderDate,
    reminderEnabled,
    roleDisplay,
    save,
    saving,
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
  };
};
