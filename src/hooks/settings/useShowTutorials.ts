import { useState } from 'react';
import { storage } from '#/storage/mmkv';
import { useTutorialResetSignal } from '#hooks/ui/useTutorialResetSignal';

/**
 * Reads MMKV rather than firing `GetUserSettings`; `useAppSettings` writes the
 * value whenever it loads fresh data. Re-reads on a tutorial reset.
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
