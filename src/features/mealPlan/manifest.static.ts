import type { StaticFeatureManifest } from '#features/staticTypes';
import en from './locales/en.json';
import es from './locales/es.json';
import it from './locales/it.json';
import sq from './locales/sq.json';

export const mealPlanStaticFeature: StaticFeatureManifest = {
  id: 'mealPlan',
  locales: { en, es, it, sq },
};
