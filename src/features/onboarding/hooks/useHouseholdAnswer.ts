import { useRef } from 'react';
import { COOKS_FOR_MAX } from '#domain/servings';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useRecordOnboardingProgress } from '#features/onboarding/store/onboardingProgressStore';

/**
 * Who the user cooks for: recorded for the summary and saved to their dietary
 * profile, where recipes read it. A count outside 1–20 is never sent.
 */
export function useHouseholdAnswer() {
  const { editableProfile, updateDietaryProfile } = useDietaryProfile({
    fetchPolicy: 'cache-first',
  });
  const { recordCooksFor } = useRecordOnboardingProgress();
  const latest = useRef<number | null>(null);

  /**
   * Resolves once the write landed or queued, or failed and was alerted. The
   * dietary step waits on it: both may create the profile row, and two
   * creates at once collide on the user.
   */
  const answer = async (count: number): Promise<void> => {
    if (!Number.isInteger(count) || count < 1 || count > COOKS_FOR_MAX) return;
    latest.current = count;
    const saved = await updateDietaryProfile({ cooksFor: count });
    // An earlier save can resolve after a later one: only the last asked counts.
    if (saved && latest.current === count) recordCooksFor(count);
  };

  return {
    answer,
    /** The count already saved, shown again on a return; null when none. */
    saved: editableProfile?.cooksFor ?? null,
  };
}
