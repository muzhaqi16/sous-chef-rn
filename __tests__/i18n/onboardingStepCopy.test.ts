import { mergedLocale } from '#/test-utils/mergedLocales';
import { ONBOARDING_STEPS } from '#features/onboarding/hooks/useOnboardingNavigation';

/**
 * The flow's sequence and its copy are one thing said twice, and only the
 * sequence is executable — so a step removed from the flow leaves its copy
 * behind with nothing to render it, and a step added arrives untranslated.
 *
 * `check-i18n` cannot see either: the four locales agree with each other
 * whether or not they agree with the flow.
 */
const LOCALES = ['en', 'es', 'it', 'sq'];

const stepKeys = (locale: string): string[] => {
  const tree = mergedLocale(locale) as {
    onboardingSteps?: Record<string, unknown>;
  };
  return Object.keys(tree.onboardingSteps ?? {}).sort();
};

describe('onboarding step copy tracks the flow', () => {
  it.each(LOCALES)('%s declares copy for exactly the flow steps', locale => {
    // Order-insensitive: the flow's order is the flow's business, and the
    // JSON's is whatever it was written in.
    expect(stepKeys(locale)).toEqual([...ONBOARDING_STEPS].sort());
  });

  it('has a step list to check against', () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThan(0);
  });
});
