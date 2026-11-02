import { renderHook } from '@testing-library/react-native';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useMirroredSetting } from '#store/useAppStore';
import { useBudgetAndPricesEnabled } from '../useBudgetAndPricesEnabled';

jest.mock('#hooks/settings/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(),
}));
jest.mock('#store/useAppStore', () => ({
  useMirroredSetting: jest.fn(),
}));

const given = ({
  offered,
  answer,
}: {
  offered: boolean;
  answer: boolean | null;
}) => {
  jest.mocked(useFeatureFlag).mockReturnValue(offered);
  jest.mocked(useMirroredSetting).mockReturnValue(answer);
  return renderHook(() => useBudgetAndPricesEnabled()).result.current;
};

describe('useBudgetAndPricesEnabled', () => {
  // Prices stay hidden until there is enough price data and the user says yes.
  it('is off for an account that never answered', () => {
    expect(given({ offered: true, answer: null })).toBe(false);
  });

  it('is on once the account turns it on', () => {
    expect(given({ offered: true, answer: true })).toBe(true);
  });

  it('is off after "Not now"', () => {
    expect(given({ offered: true, answer: false })).toBe(false);
  });

  it('stays off where the build withholds it, whatever the account chose', () => {
    expect(given({ offered: false, answer: true })).toBe(false);
  });
});
