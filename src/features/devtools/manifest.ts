import type { FeatureManifest } from '../types';

export const devtoolsFeature: FeatureManifest = {
  id: 'devtools',
  // No tab — reached from Profile's developer rows, which are themselves gated.
};
