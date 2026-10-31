import { act, renderHook } from '@testing-library/react-native';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
} from '#features/onboarding/store/onboardingProgressStore';
import { useHouseholdAnswer } from '../useHouseholdAnswer';

// The write's cache and replay are pinned in HouseholdStepScreen.test.tsx;
// this pins which counts are sent at all.
const mockUpdate = jest.fn().mockResolvedValue(true);
jest.mock('#features/profile/hooks/useDietaryProfile', () => ({
  useDietaryProfile: () => ({ updateDietaryProfile: mockUpdate }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
});

async function answer(count: number) {
  const { result } = renderHook(() => useHouseholdAnswer());
  await act(async () => {
    await result.current.answer(count);
  });
}

describe('useHouseholdAnswer', () => {
  it('saves a count from 1 to 20', async () => {
    await answer(20);

    expect(mockUpdate).toHaveBeenCalledWith({ cooksFor: 20 });
    expect(useOnboardingProgressStore.getState().cooksFor).toBe(20);
  });

  it.each([0, 21, 2.5])('never sends %p', async count => {
    await answer(count);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(useOnboardingProgressStore.getState().cooksFor).toBeNull();
  });
});
