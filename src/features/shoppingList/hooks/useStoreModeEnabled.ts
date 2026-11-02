import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useMirroredSetting } from '#store/useAppStore';

/** The build offers store mode and the account has it on (the default). */
export function useStoreModeEnabled(): boolean {
  const offered = useFeatureFlag('storeMode');
  const enabled = useMirroredSetting('storeMode');
  return offered && enabled;
}
