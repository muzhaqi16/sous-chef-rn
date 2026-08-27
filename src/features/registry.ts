import { appConfig } from '#/config/appConfig';
import type { FeatureManifest, TabAppearance, TabbedFeature } from './types';
import { pantryFeature } from './pantry/manifest';
import { shoppingListFeature } from './shoppingList/manifest';
import { recipesFeature } from './recipes/manifest';
import { mealPlanFeature } from './mealPlan/manifest';
import { barcodeFeature } from './barcode/manifest';
import { notificationsFeature } from './notifications/manifest';
import { profileFeature } from './profile/manifest';
import { homeFeature } from './home/manifest';
import { catalogFeature } from './catalog/manifest';

/**
 * Canonical list of all features in the app.
 *
 * Navigation consumers iterate this to build tabs and to gate features. To
 * remove a feature from a fork: set `enabled: false` on its manifest to build
 * without it, or delete its folder and its entry here to remove the code.
 */
export const FEATURE_REGISTRY: FeatureManifest[] = [
  pantryFeature,
  shoppingListFeature,
  recipesFeature,
  mealPlanFeature,
  barcodeFeature,
  notificationsFeature,
  profileFeature,
  homeFeature,
  catalogFeature,
];

/**
 * A feature ships unless something says otherwise. Two independent switches:
 *
 * - the manifest's own `enabled`, which the feature's owner controls;
 * - `appConfig.features[id]`, which the APP controls — the one file a fork
 *   edits to decide what it ships.
 *
 * Either being `false` drops it. Absent means enabled, so only an opt-out is
 * ever written down.
 */
const isEnabled = (feature: FeatureManifest) =>
  feature.enabled !== false && appConfig.features[feature.id] !== false;

export const ENABLED_FEATURES = FEATURE_REGISTRY.filter(isEnabled);

/** Features that have a tab in the bottom tab navigator, sorted by order. */
export const TAB_FEATURES: TabbedFeature[] = ENABLED_FEATURES.filter(
  (f): f is TabbedFeature => !!f.tab,
).sort((a, b) => a.tab.order - b.tab.order);

/**
 * Tab icons and reset-to-root targets, keyed by screen name.
 *
 * `FloatingTabBar` and `TabItem` live in the kit and must not import this
 * module; `HomeTabs` passes this down to them as a prop.
 */
export const TAB_APPEARANCE: TabAppearance = Object.fromEntries(
  TAB_FEATURES.map(f => [
    f.tab.screenName,
    { icon: f.tab.icon, mainScreen: f.tab.mainScreen },
  ]),
);
