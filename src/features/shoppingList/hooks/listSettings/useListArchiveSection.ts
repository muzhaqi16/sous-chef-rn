import { useTranslation } from '#i18n';
import { ListStatus } from '#graphql/generated/schemaTypes';
import { alertService } from '#services/alertService';
import { destructiveConfirm } from '#services/destructiveConfirm';
import { subscriptionService } from '#services/subscriptions/SubscriptionService';
import { toastService } from '#services/toastService';
import { useCompleteShoppingList } from '#features/shoppingList/hooks/mutations/useCompleteShoppingList';
import { useDeleteShoppingList } from '#features/shoppingList/hooks/mutations/useDeleteShoppingList';
import { useUpdateShoppingList } from '#features/shoppingList/hooks/mutations/useUpdateShoppingList';
import type { SettingsList } from './types';

interface ListArchiveOptions {
  listId: string | undefined;
  shoppingList: SettingsList;
  /** Leaves the screen once the list is gone for this person. */
  leaveGoneList: () => void;
}

/** The list's lifecycle: completed, archived, or deleted. */
export function useListArchiveSection({
  listId,
  shoppingList,
  leaveGoneList,
}: ListArchiveOptions) {
  const { t } = useTranslation();
  const { updateShoppingList } = useUpdateShoppingList(
    t('errors.saveSettingsFailed'),
  );
  const { completeList, reactivateList, completing, reactivating } =
    useCompleteShoppingList();
  const { deleteShoppingList } = useDeleteShoppingList();

  // Lifecycle status is read straight off the list (server-truth), not derived
  // from item counts.
  const status = shoppingList?.status ?? ListStatus.Active;
  const isCompleted =
    shoppingList?.isCompleted ?? status === ListStatus.Completed;
  const isArchived = status === ListStatus.Archived;
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

  const setStatus = async (next: ListStatus) => {
    if (!listId) return;
    try {
      await updateShoppingList(listId, { status: next });
    } catch {
      toastService.error(t('shoppingListScreens.failedToArchive'));
    }
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
    // useShoppingListSelection then auto-selects the next list; leaving
    // unmounts this screen's query watcher, so a late subscription update
    // cannot trigger a refetch of the deleted list.
    leaveGoneList();
  };

  return {
    statusDisplay,
    isCompleted,
    isArchived,
    completedShopDate: shoppingList?.completedShopDate ?? null,
    completing,
    reactivating,
    // Complete / reactivate — the hook owns its own failure alert and
    // optimistic revert, so this only fires the right direction.
    handleToggleComplete: () => {
      if (!listId) return;
      if (isCompleted) void reactivateList(listId);
      else void completeList(listId);
    },
    handleArchiveToggle: async () => {
      if (!listId) return;
      // Restoring is non-destructive — flip straight back to active.
      if (isArchived) {
        await setStatus(ListStatus.Active);
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
              void setStatus(ListStatus.Archived);
            },
          },
        ],
      );
    },
    handleDelete: () => {
      if (!listId) return; // The delete button is hidden without a list.
      alertService.alert(
        t('labels.deleteList'),
        t('shoppingListSelector.deleteAlertMessage', { count: 1 }),
        destructiveConfirm(t('labels.delete'), () => {
          void deleteList(listId);
        }),
      );
    },
  };
}
