import { useShoppingListReminder } from '#features/shoppingList/hooks/mutations/useShoppingListReminder';
import { dayAsInstant } from '#utils/dateUtils';
import type { SettingsList } from './types';

/** The list's reminder: a picked date sets it, the clear action removes it. */
export function useListReminderSection(
  listId: string | undefined,
  shoppingList: SettingsList,
) {
  const { setReminder, clearReminder } = useShoppingListReminder();
  return {
    reminderEnabled: shoppingList?.reminderEnabled ?? false,
    reminderDate: shoppingList?.reminderDate ?? null,
    // The API reads the reminder's day in the owner's recorded time zone.
    handleSetReminderDate: (date: Date | null) => {
      if (listId && date) void setReminder(listId, dayAsInstant(date), true);
    },
    handleClearReminder: () => {
      if (listId) void clearReminder(listId);
    },
  };
}
