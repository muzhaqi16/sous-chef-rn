import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';

/**
 * The capture sources this user may start, each switched on its own. `any`
 * keeps what a started capture left behind: its row, its poll and its review.
 */
export function useCaptureSources() {
  const url = useFeatureFlag('recipeCaptureUrl');
  const text = useFeatureFlag('recipeCaptureText');
  const photo = useFeatureFlag('recipeCapturePhoto');
  return { url, text, photo, any: url || text || photo };
}
