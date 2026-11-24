import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { RecurringPattern } from '#/graphql/generated/schemaTypes';
import { useRecurringShoppingList } from '#features/shoppingList/hooks/mutations/useRecurringShoppingList';
import type { SettingsList } from './types';

interface ListRecurrenceOptions {
  listId: string | undefined;
  shoppingList: SettingsList;
  /** Runs the work under the screen's one saving flag, saying `failure` if it throws. */
  runSaving: (work: () => Promise<void>, failure: string) => Promise<void>;
  openList: (id: string) => void;
}

/** Whether the list repeats, on what pattern, and its next copy. */
export function useListRecurrenceSection({
  listId,
  shoppingList,
  runSaving,
  openList,
}: ListRecurrenceOptions) {
  const { t } = useTranslation();
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const { setRecurring, cancelRecurring, generateNext, generating } =
    useRecurringShoppingList();

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

  return {
    isRecurring: shoppingList?.isRecurring ?? false,
    recurringPattern: shoppingList?.recurringPattern ?? null,
    nextRecurringDate: shoppingList?.nextRecurringDate ?? null,
    patternLabel,
    showPatternPicker,
    setShowPatternPicker,
    // Interval defaults to 1; custom intervals are not exposed here.
    handleSelectPattern: (pattern: RecurringPattern) => {
      setShowPatternPicker(false);
      if (listId) void setRecurring(listId, pattern, 1);
    },
    handleStopRecurring: () => {
      if (listId) void cancelRecurring(listId);
    },
    handleGenerateNext: () => {
      if (!listId) return;
      void runSaving(async () => {
        const newListId = await generateNext(listId);
        if (newListId) openList(newListId);
      }, t('shoppingListScreens.failedToGenerateNext'));
    },
    generating,
  };
}
