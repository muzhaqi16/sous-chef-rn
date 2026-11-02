import {
  MIRRORED_SETTINGS,
  mirroredFrom,
  settingsInput,
} from '#/domain/serverSettings';
import { AppTheme, UnitSystem } from '#/graphql/generated/schemaTypes';

describe('settingsInput', () => {
  it('puts each setting in the group updateSettings takes it in', () => {
    expect(
      settingsInput({
        theme: AppTheme.Dark,
        showTutorials: false,
        preferredUnitSystem: UnitSystem.Metric,
        storeMode: false,
        budgetAndPrices: true,
      }),
    ).toEqual({
      ui: { theme: AppTheme.Dark, showTutorials: false },
      regional: { preferredUnitSystem: UnitSystem.Metric },
      shopping: { storeMode: false, budgetAndPrices: true },
    });
  });

  it('sends no group a change leaves alone', () => {
    expect(settingsInput({ storeMode: true })).toEqual({
      shopping: { storeMode: true },
    });
  });
});

describe('the mirrored settings', () => {
  // Store mode on, prices hidden and not yet answered.
  it('start a signed-out device at the account defaults', () => {
    expect(MIRRORED_SETTINGS).toEqual({
      showTutorials: true,
      storeMode: true,
      budgetAndPrices: null,
    });
  });

  it('take what a source states, a null answer included', () => {
    expect(mirroredFrom({ storeMode: false, budgetAndPrices: null })).toEqual({
      storeMode: false,
      budgetAndPrices: null,
    });
  });

  it('leave out what a source does not state', () => {
    expect(mirroredFrom({ showTutorials: false })).toEqual({
      showTutorials: false,
    });
    expect(mirroredFrom(null)).toEqual({});
  });
});
