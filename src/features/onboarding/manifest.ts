import type { FeatureManifest } from '../types';

export const onboardingFeature: FeatureManifest = {
  id: 'onboarding',
  // No tab — the onboarding stack is a gate in RootNavigator, mounted only
  // while `useIsOnboarding` holds.
};
