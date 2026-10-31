import { COOKS_FOR_MAX } from '#domain/servings';
import { useDietaryProfile } from '#features/profile/hooks/useDietaryProfile';
import { useRecordOnboardingProgress } from '#features/onboarding/store/onboardingProgressStore';

/**
 * Who the user cooks for: recorded for the summary and saved to their dietary
 * profile, where recipes read it. A count outside 1–20 is never sent.
 */
export function useHouseholdAnswer() {
  const { updateDietaryProfile } = useDietaryProfile({
    fetchPolicy: 'cache-first',
  });
  const { recordCooksFor } = useRecordOnboardingProgress();

  /**
   * Resolves once the write landed or queued, or failed and was alerted. The
   * dietary step waits on it: both may create the profile row, and two
   * creates at once collide on the user.
   */
  const answer = async (count: number): Promise<void> => {
    if (!Number.isInteger(count) || count < 1 || count > COOKS_FOR_MAX) return;
    recordCooksFor(count);
    await updateDietaryProfile({ cooksFor: count });
  };

  return { answer };
}
