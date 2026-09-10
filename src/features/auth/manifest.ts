import type { FeatureManifest } from '../types';

export const authFeature: FeatureManifest = {
  id: 'auth',
  // No tab — the auth stack is a gate in RootNavigator, mounted only while
  // `useIsAuth` holds. There is no app behind it to tab between.
};
