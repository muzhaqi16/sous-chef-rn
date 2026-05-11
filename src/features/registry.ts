import type { FeatureManifest } from './types';
import { pantryFeature } from './pantry/manifest';
import { shoppingListFeature } from './shoppingList/manifest';
import { recipesFeature } from './recipes/manifest';
import { mealPlanFeature } from './mealPlan/manifest';
import { barcodeFeature } from './barcode/manifest';
import { notificationsFeature } from './notifications/manifest';
import { profileFeature } from './profile/manifest';

/**
 * Canonical list of all features in the app.
 *
 * Navigation consumers iterate this to build tabs, register deep-link
 * screens, and (in the future) conditionally gate features.
 *
 * To remove a feature from a fork: delete its folder under src/features/
 * and remove its entry here.
 */
export const FEATURE_REGISTRY: FeatureManifest[] = [
  pantryFeature,
  shoppingListFeature,
  recipesFeature,
  mealPlanFeature,
  barcodeFeature,
  notificationsFeature,
  profileFeature,
];

/** Features that have a tab in the bottom tab navigator, sorted by order. */
export const TAB_FEATURES = FEATURE_REGISTRY.filter(
  (f): f is FeatureManifest & { tab: NonNullable<FeatureManifest['tab']> } =>
    !!f.tab,
).sort((a, b) => a.tab.order - b.tab.order);
