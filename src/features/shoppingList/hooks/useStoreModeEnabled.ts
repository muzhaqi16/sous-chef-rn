import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useUserPreference } from '#hooks/settings/useUserPreferences';

/** The build offers store mode and this user turned it on in Settings. */
export function useStoreModeEnabled(): boolean {
  const offered = useFeatureFlag('storeMode');
  const [enabled] = useUserPreference('storeMode');
  return offered && enabled;
}
