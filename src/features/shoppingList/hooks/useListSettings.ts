import { useRef, useState } from 'react';
import { useTranslation } from '#/i18n';
import { toastService } from '#/services/toastService';
import { useNavigationIntents } from '#platform/screen';
import { useDataState } from '#hooks/data/useDataState';
import { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import { useShoppingListPermissions } from '#features/shoppingList/hooks/useShoppingListPermissions';
import { canDeleteShoppingList } from '#features/shoppingList/utils/shoppingListPermissions';
import { useAppStore, useUser } from '#store/useAppStore';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { formatMonthDayYear } from '#/utils/formatters/date';
import { useListArchiveSection } from './listSettings/useListArchiveSection';
import { useListDetailsSection } from './listSettings/useListDetailsSection';
import { useListMembershipSection } from './listSettings/useListMembershipSection';
import { useListRecurrenceSection } from './listSettings/useListRecurrenceSection';
import { useListReminderSection } from './listSettings/useListReminderSection';

/**
 * Everything the list-settings screen needs that is not markup, one group per
 * section of the screen over the list they all read.
 */
export const useListSettings = (listId: string | undefined) => {
  const { t } = useTranslation();
  const { goBack } = useNavigationIntents();
  const setSelectedShoppingListId = useAppStore(
    state => state.setSelectedShoppingListId,
  );
  const user = useUser();

  const listDetails = useShoppingListDetails(listId);
  const { shoppingList } = listDetails;
  const detailsState = useDataState({
    loading: listDetails.loading,
    hasResult: listDetails.hasResult,
    isEmpty: false,
  });

  // Saving, making from a template and generating the next copy share the
  // screen's one saving flag.
  const [saving, setSaving] = useState(false);
  const runSaving = (work: () => Promise<void>, failure: string) =>
    executeWithLoadingState(work, setSaving, () => {
      toastService.error(failure);
    });

  // A list made here becomes the selected one, and the screen gives way to it.
  const openList = (id: string) => {
    setSelectedShoppingListId(id);
    goBack();
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

  const membership = useListMembershipSection({
    listId,
    details: listDetails,
    leaveGoneList,
  });
  // The API's EDIT, which every section but the default and sharing takes:
  // the owner, a home's MEMBER and above, a collaborator holding canEdit.
  const permissions = useShoppingListPermissions(shoppingList, user?.id);
  const details = useListDetailsSection({
    listId,
    shoppingList,
    runSaving,
    openList,
  });
  const recurrence = useListRecurrenceSection({
    listId,
    shoppingList,
    runSaving,
    openList,
  });
  const reminder = useListReminderSection(listId, shoppingList);
  const archive = useListArchiveSection({
    listId,
    shoppingList,
    leaveGoneList,
  });

  return {
    listId,
    shoppingList,
    detailsState,
    saving,
    canEdit: membership.isOwner || permissions.canEditList,
    canDelete: canDeleteShoppingList(
      membership.isOwner,
      shoppingList?.home?.myMembership?.role,
    ),
    formatDate: (dateString?: string | null) =>
      dateString ? formatMonthDayYear(new Date(dateString)) : t('labels.never'),
    details,
    recurrence,
    reminder,
    membership,
    archive,
  };
};
