/**
 * Capabilities that ship inside a feature and can be switched off per fork, per
 * build, or per user by the server, so the feature around them works as it did
 * without them. A whole feature is switched by `appConfig.features` instead.
 */
export type FeatureFlag =
  | 'deviceReceiptModel'
  | 'deviceReceiptReading'
  | 'ingredientPaste'
  | 'pantrySuggestions'
  | 'receiptParsing'
  | 'recipeCapturePhoto'
  | 'recipeCaptureText'
  | 'recipeCaptureUrl'
  | 'storeMode'
  | 'storeRoutes';

/**
 * What a build allows when neither the fork nor the build says otherwise. A
 * flag the server owns is on only where the server also says so for the user.
 */
const FEATURE_FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  // The phone's own model reads a receipt beside the rules; off, rules alone.
  deviceReceiptModel: false,
  // A receipt read on the phone by `@muzhaqi16/receipt-rules` first, kept when it
  // adds up; off, every receipt is read as `receiptParsing` says.
  deviceReceiptReading: true,
  // Pasted ingredient lines read by the API's `parseIngredientLines`.
  ingredientPaste: true,
  // Discovery ranked by the API's `recipeSuggestions`; off, Spoonacular ranks it.
  pantrySuggestions: true,
  // A receipt read by the API's `createReceiptParse`; off, only the phone reads it.
  receiptParsing: true,
  // Recipes from cookbook photos, shared text or a page's link (`createRecipeCapture`).
  recipeCapturePhoto: true,
  recipeCaptureText: true,
  recipeCaptureUrl: true,
  // Store mode: the list walked aisle by aisle on a screen of its own, which a
  // user turns on in Settings; off, the shopping list offers no way in.
  storeMode: true,
  // A list's walking order learned from trips (`ShoppingList.storeRoute`).
  storeRoutes: true,
};

const isFeatureFlag = (name: string): name is FeatureFlag =>
  Object.hasOwn(FEATURE_FLAG_DEFAULTS, name);

function switchValue(value: string): boolean | undefined {
  switch (value.toLowerCase()) {
    case 'on':
    case 'true':
      return true;
    case 'off':
    case 'false':
      return false;
    default:
      return undefined;
  }
}

/**
 * A build's `FEATURE_FLAGS` value, `pantrySuggestions=off,ingredientPaste=on`.
 * An unknown flag or value is ignored, so a stale build setting cannot fail
 * the app.
 */
function parseFeatureFlagOverrides(
  raw: string | undefined,
): Partial<Record<FeatureFlag, boolean>> {
  const overrides: Partial<Record<FeatureFlag, boolean>> = {};
  for (const entry of (raw ?? '').split(',')) {
    const [name = '', value = ''] = entry.split('=').map(part => part.trim());
    const enabled = switchValue(value);
    if (isFeatureFlag(name) && enabled !== undefined) overrides[name] = enabled;
  }
  return overrides;
}

/** The defaults, then the fork's choice, then the build's: the last one set wins. */
export function resolveFeatureFlags(
  fork: Partial<Record<FeatureFlag, boolean>>,
  buildOverrides: string | undefined,
): Record<FeatureFlag, boolean> {
  return {
    ...FEATURE_FLAG_DEFAULTS,
    ...fork,
    ...parseFeatureFlagOverrides(buildOverrides),
  };
}
