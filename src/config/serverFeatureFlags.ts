import { FeatureFlagName } from '#/graphql/generated/schemaTypes';
import type { FeatureFlag } from './featureFlags';

/*
 * The flags the server decides per user (`myFeatureFlags`), kept apart from
 * `featureFlags.ts`: that module is on the launch path, and the schema's
 * enums are not.
 */

// Exhaustive, so a flag the schema adds fails to compile until it is mapped.
const SERVER_FLAG: Record<FeatureFlagName, FeatureFlag> = {
  [FeatureFlagName.IngredientPaste]: 'ingredientPaste',
  [FeatureFlagName.PantrySuggestions]: 'pantrySuggestions',
  [FeatureFlagName.ReceiptParsing]: 'receiptParsing',
  [FeatureFlagName.RecipeCapturePhoto]: 'recipeCapturePhoto',
  [FeatureFlagName.RecipeCaptureText]: 'recipeCaptureText',
  [FeatureFlagName.RecipeCaptureUrl]: 'recipeCaptureUrl',
  [FeatureFlagName.StoreRoutes]: 'storeRoutes',
};

const SERVER_OWNED = new Set<FeatureFlag>(Object.values(SERVER_FLAG));

// A newer server can name a flag this build was compiled without.
const isKnownServerFlag = (name: string): name is FeatureFlagName =>
  Object.hasOwn(SERVER_FLAG, name);

/** Whether the server decides this flag per user. */
export const isServerOwned = (flag: FeatureFlag): boolean =>
  SERVER_OWNED.has(flag);

/** The server's answer as client flags; a flag this build does not know is ignored. */
export function serverFlagsOf(
  states: readonly { flag: string; enabled: boolean }[],
): Partial<Record<FeatureFlag, boolean>> {
  const flags: Partial<Record<FeatureFlag, boolean>> = {};
  for (const { flag, enabled } of states) {
    if (isKnownServerFlag(flag)) flags[SERVER_FLAG[flag]] = enabled;
  }
  return flags;
}
