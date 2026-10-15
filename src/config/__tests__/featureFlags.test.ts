import { FeatureFlagName } from '#/graphql/generated/schemaTypes';
import { resolveFeatureFlags } from '#/config/featureFlags';
import { isServerOwned, serverFlagsOf } from '#/config/serverFeatureFlags';

describe('resolveFeatureFlags', () => {
  // The server decides per user; the build only allows.
  it('allows every capability by default', () => {
    expect(resolveFeatureFlags({}, undefined)).toEqual({
      ingredientPaste: true,
      pantrySuggestions: true,
      receiptParsing: true,
      recipeCapturePhoto: true,
      recipeCaptureText: true,
      recipeCaptureUrl: true,
      storeMode: true,
      storeRoutes: true,
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
        'pantrySuggestions=on, ingredientPaste = OFF, recipeCaptureText=off',
      ),
    ).toMatchObject({
      pantrySuggestions: true,
      ingredientPaste: false,
      recipeCaptureText: false,
      recipeCaptureUrl: true,
    });
  });

  it('ignores a flag or a value it does not know', () => {
    expect(
      resolveFeatureFlags({}, 'retiredFlag=off,ingredientPaste=maybe,,='),
    ).toEqual({
      ingredientPaste: true,
      pantrySuggestions: true,
      receiptParsing: true,
      recipeCapturePhoto: true,
      recipeCaptureText: true,
      recipeCaptureUrl: true,
      storeMode: true,
      storeRoutes: true,
    });
  });
});

describe('serverFlagsOf', () => {
  it("reads the server's answer as the client's flags", () => {
    expect(
      serverFlagsOf([
        { flag: FeatureFlagName.RecipeCaptureUrl, enabled: true },
        { flag: FeatureFlagName.IngredientPaste, enabled: false },
      ]),
    ).toEqual({ recipeCaptureUrl: true, ingredientPaste: false });
  });

  it('ignores a flag a newer server names', () => {
    expect(serverFlagsOf([{ flag: 'MEAL_PLAN_AI', enabled: true }])).toEqual(
      {},
    );
  });

  it('knows which flags the server owns', () => {
    expect(isServerOwned('recipeCapturePhoto')).toBe(true);
    expect(isServerOwned('pantrySuggestions')).toBe(true);
  });
});
