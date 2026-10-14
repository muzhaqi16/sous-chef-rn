import { FeatureFlagName } from '#/graphql/generated/schemaTypes';
import { resolveFeatureFlags } from '#/config/featureFlags';
import { isServerOwned, serverFlagsOf } from '#/config/serverFeatureFlags';

describe('resolveFeatureFlags', () => {
  // The server decides per user; the build only allows.
  it('allows every capability by default', () => {
    expect(resolveFeatureFlags({}, undefined)).toEqual({
      ingredientPaste: true,
      pantrySuggestions: true,
      recipeCapture: true,
    });
  });

  it("takes the fork's choice over the default", () => {
    expect(
      resolveFeatureFlags({ pantrySuggestions: false }, undefined),
    ).toMatchObject({ pantrySuggestions: false, ingredientPaste: true });
  });

  it("takes the build's choice over the fork's", () => {
    expect(
      resolveFeatureFlags(
        { pantrySuggestions: false },
        'pantrySuggestions=on, ingredientPaste = OFF, recipeCapture=on',
      ),
    ).toEqual({
      pantrySuggestions: true,
      ingredientPaste: false,
      recipeCapture: true,
    });
  });

  it('ignores a flag or a value it does not know', () => {
    expect(
      resolveFeatureFlags({}, 'retiredFlag=off,ingredientPaste=maybe,,='),
    ).toEqual({
      ingredientPaste: true,
      pantrySuggestions: true,
      recipeCapture: true,
    });
  });
});

describe('serverFlagsOf', () => {
  it("reads the server's answer as the client's flags", () => {
    expect(
      serverFlagsOf([
        { flag: FeatureFlagName.RecipeCapture, enabled: true },
        { flag: FeatureFlagName.IngredientPaste, enabled: false },
      ]),
    ).toEqual({ recipeCapture: true, ingredientPaste: false });
  });

  it('ignores a flag a newer server names', () => {
    expect(serverFlagsOf([{ flag: 'MEAL_PLAN_AI', enabled: true }])).toEqual(
      {},
    );
  });

  it('knows which flags the server owns', () => {
    expect(isServerOwned('recipeCapture')).toBe(true);
    expect(isServerOwned('pantrySuggestions')).toBe(true);
  });
});
