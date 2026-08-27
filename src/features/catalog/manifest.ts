import type { FeatureManifest } from '../types';

export const catalogFeature: FeatureManifest = {
  id: 'catalog',
  // No tab — the catalog is reached through the forms and pickers that consume
  // it, plus the storage-locations screen under household settings.
};
