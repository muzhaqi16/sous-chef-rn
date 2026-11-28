import { useStore } from '#store';
import { usePreferences } from '#store/useAppStore';
import { useUpdateSettings } from '#hooks/settings/useUpdateSettings';

/**
 * The app's language: switched on the device at once and saved to the account
 * through the settings writer, so offline it queues and replays. A refused
 * save puts back what was there, unless a later pick replaced it: for someone
 * who never picked, that is following the device.
 */
export function useLanguagePreference() {
  const { language, setLanguage } = usePreferences();
  const { updateSettings } = useUpdateSettings();

  const selectLanguage = async (next: string): Promise<void> => {
    const previous = language;
    setLanguage(next);
    const landed = await updateSettings({ language: next });
    if (!landed && useStore.getState().language === next) {
      setLanguage(previous);
    }
  };

  return { language, selectLanguage };
}
