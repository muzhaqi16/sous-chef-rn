import { useState } from 'react';
import { storage } from '#/storage/mmkv';
import { useTutorialResetSignal } from '#hooks/ui/useTutorialResetSignal';

/**
 * Selector hook for just the showTutorials setting
 * Use this when you only need to check if tutorials are enabled
 *
 * PERFORMANCE: Reads from MMKV instead of triggering the GetUserSettings GraphQL query.
 * The MMKV value is synced whenever useAppSettings loads fresh data (see useAppSettings).
 * Re-reads on tutorial reset so hooks see the updated value immediately.
 */
export const useShowTutorials = (): boolean => {
  const wasReset = useTutorialResetSignal();
  const [value, setValue] = useState(
    () => storage.getBoolean('user_show_tutorials') ?? true,
  );
  if (wasReset) {
    setValue(storage.getBoolean('user_show_tutorials') ?? true);
  }
  return value;
};
