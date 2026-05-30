/**
 * Feature Flag Types
 *
 * Defines the structure and types for the feature flag system.
 */

/**
 * Supported feature flag value types
 */
export type FeatureFlagValue = boolean | string | number | object;

/**
 * Feature flag definition
 */
export interface FeatureFlag {
  /** Unique flag key */
  key: string;
  /** Flag value */
  value: FeatureFlagValue;
  /** Flag description for documentation */
  description?: string;
  /** Flag type */
  type: 'boolean' | 'string' | 'number' | 'json';
  /** Default value if flag is not set */
  defaultValue: FeatureFlagValue;
  /** Whether this flag can be overridden locally */
  allowOverride?: boolean;
  /** Targeting rules for user segmentation */
  targeting?: TargetingRule[];
}

/**
 * User targeting rule for A/B testing and segmentation
 */
export interface TargetingRule {
  /** Rule type */
  type: 'userId' | 'userPercent' | 'custom';
  /** Condition to match */
  condition: string | number | ((context: UserContext) => boolean);
  /** Value to return if condition matches */
  value: FeatureFlagValue;
}

/**
 * User context for flag evaluation
 */
export interface UserContext {
  userId?: string;
  email?: string;
  role?: string;
  customAttributes?: Record<string, unknown>;
}

/**
 * Feature flag configuration
 */
export interface FeatureFlagConfig {
  /** All feature flags */
  flags: Record<string, FeatureFlag>;
  /** When the config was last updated */
  lastUpdated?: number;
  /** Version of the config */
  version?: string;
}

/**
 * Local flag override for testing
 */
export interface FlagOverride {
  key: string;
  value: FeatureFlagValue;
  expiresAt?: number;
}

/**
 * Feature flag keys (strongly typed)
 */
export enum FeatureFlagKey {
  // Recipe features
  RECIPE_RECOMMENDATIONS = 'recipe.recommendations',
  RECIPE_AI_SUGGESTIONS = 'recipe.aiSuggestions',
  RECIPE_MEAL_PLANNER = 'recipe.mealPlanner',

  // Shopping list features
  SHOPPING_SMART_CATEGORIZATION = 'shopping.smartCategorization',
  SHOPPING_PRICE_TRACKING = 'shopping.priceTracking',
  SHOPPING_SHARED_LISTS = 'shopping.sharedLists',

  // Pantry features
  PANTRY_BARCODE_SCANNER = 'pantry.barcodeScanner',
  PANTRY_EXPIRY_NOTIFICATIONS = 'pantry.expiryNotifications',
  PANTRY_SMART_STORAGE = 'pantry.smartStorage',

  // UI/UX features
  UI_NEW_ONBOARDING = 'ui.newOnboarding',
  UI_DARK_MODE_AUTO = 'ui.darkModeAuto',
  UI_ANIMATIONS_ENHANCED = 'ui.animationsEnhanced',

  // Performance features
  PERF_IMAGE_OPTIMIZATION = 'perf.imageOptimization',
  PERF_LAZY_LOADING = 'perf.lazyLoading',

  // Experimental features
  EXPERIMENTAL_AI_CHAT = 'experimental.aiChat',
  EXPERIMENTAL_VOICE_COMMANDS = 'experimental.voiceCommands',
}
