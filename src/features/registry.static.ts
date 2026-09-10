import type { StaticFeatureManifest } from './staticTypes';
import { pantryStaticFeature } from './pantry/manifest.static';
import { shoppingListStaticFeature } from './shoppingList/manifest.static';
import { recipesStaticFeature } from './recipes/manifest.static';
import { mealPlanStaticFeature } from './mealPlan/manifest.static';
import { catalogStaticFeature } from './catalog/manifest.static';
import { profileStaticFeature } from './profile/manifest.static';
import { homeStaticFeature } from './home/manifest.static';
import { notificationsStaticFeature } from './notifications/manifest.static';
import { barcodeStaticFeature } from './barcode/manifest.static';
import { authStaticFeature } from './auth/manifest.static';
import { onboardingStaticFeature } from './onboarding/manifest.static';
import { devtoolsStaticFeature } from './devtools/manifest.static';

/**
 * Every feature, as the APP SHELL sees it — i18n init, the cache, the offline
 * queue. Separate from `FEATURE_REGISTRY` because those run on the launch path
 * and the screen-bearing registry pulls the component graph in with it.
 */
export const STATIC_FEATURE_REGISTRY: StaticFeatureManifest[] = [
  pantryStaticFeature,
  shoppingListStaticFeature,
  recipesStaticFeature,
  mealPlanStaticFeature,
  catalogStaticFeature,
  profileStaticFeature,
  homeStaticFeature,
  notificationsStaticFeature,
  barcodeStaticFeature,
  authStaticFeature,
  onboardingStaticFeature,
  devtoolsStaticFeature,
];
