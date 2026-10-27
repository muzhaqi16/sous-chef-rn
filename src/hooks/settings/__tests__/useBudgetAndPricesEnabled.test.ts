import { renderHook } from '@testing-library/react-native';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useUserPreference } from '#hooks/settings/useUserPreferences';
import { defaultUserPreferences } from '#store/slices/preferencesSlice';
import { useBudgetAndPricesEnabled } from '../useBudgetAndPricesEnabled';

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(),
}));
jest.mock('#hooks/settings/useUserPreferences', () => ({
  useUserPreference: jest.fn(),
}));

const given = ({ offered, chosen }: { offered: boolean; chosen: boolean }) => {
  jest.mocked(useFeatureFlag).mockReturnValue(offered);
  jest.mocked(useUserPreference).mockReturnValue([chosen, jest.fn()]);
  return renderHook(() => useBudgetAndPricesEnabled()).result.current;
};

describe('useBudgetAndPricesEnabled', () => {
  // The plain list is the default; a person who uses budgets turns them on.
  it('is off for a person who never set it', () => {
    expect(defaultUserPreferences.budgetAndPrices).toBe(false);
    expect(given({ offered: true, chosen: false })).toBe(false);
  });

  it('is on once the person turns it on', () => {
    expect(given({ offered: true, chosen: true })).toBe(true);
  });

  it('stays off where the build withholds it, whatever the person chose', () => {
    expect(given({ offered: false, chosen: true })).toBe(false);
  });
});
