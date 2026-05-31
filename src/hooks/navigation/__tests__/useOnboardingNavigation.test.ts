import { renderHook, act } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { useOnboardingNavigation } from '../useOnboardingNavigation';
import { OnBoardingSteps } from '#store/slices/navigationSlice';
import type { User } from '#store/slices/authSlice';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockDispatch = jest.fn();
const mockGetState = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      dispatch: mockDispatch,
      getState: mockGetState,
    }),
  };
});

const mockSetOnBoardingStep = jest.fn();
const mockSetOnboarded = jest.fn();
const mockSetUserNavigationState = jest.fn();
const mockGetUserNavigationState = jest.fn();

let mockUser: User | null = {
  id: 'u1',
  email: 'test@test.com',
  emailVerified: true,
  onBoarded: false,
};

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T>(
    selectorOrFn: (state: {
      user: User | null;
      getUserNavigationState: jest.Mock;
      setUserNavigationState: jest.Mock;
      setOnBoardingStep: jest.Mock;
      setOnboarded: jest.Mock;
    }) => T,
  ): T => {
    const state = {
      user: mockUser,
      getUserNavigationState: mockGetUserNavigationState,
      setUserNavigationState: mockSetUserNavigationState,
      setOnBoardingStep: mockSetOnBoardingStep,
      setOnboarded: mockSetOnboarded,
    };
    return selectorOrFn(state);
  },
  useUser: jest.fn(() => mockUser),
  useNavigationUtils: jest.fn(() => ({
    getUserNavigationState: mockGetUserNavigationState,
    setUserNavigationState: mockSetUserNavigationState,
    setOnBoardingStep: mockSetOnBoardingStep,
    setOnboarded: mockSetOnboarded,
  })),
}));

jest.mock('zustand/shallow', () => ({
  useShallow: <S, U>(fn: (state: S) => U): ((state: S) => U) => fn,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {
    id: 'u1',
    email: 'test@test.com',
    emailVerified: true,
    onBoarded: false,
  };
  mockGetState.mockReturnValue({
    routes: [{ name: 'CreateHome' }],
    index: 0,
  });
});

describe('useOnboardingNavigation', () => {
  it('exposes the list of onboarding steps', () => {
    const { result } = renderHook(() => useOnboardingNavigation());
    expect(result.current.steps).toEqual([
      'CreateHome',
      'CreateShoppingList',
      'SelectPantryItems',
      'ProfilePictureUpload',
      'InviteMembers',
      'BiometricSetup',
      'OnboardingComplete',
    ]);
  });

  describe('getCurrentStepIndex', () => {
    it('returns the index for a valid step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());
      expect(result.current.getCurrentStepIndex('CreateHome')).toBe(0);
      expect(result.current.getCurrentStepIndex('InviteMembers')).toBe(4);
      expect(result.current.getCurrentStepIndex('OnboardingComplete')).toBe(6);
    });

    it('returns -1 for an unknown step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());
      expect(result.current.getCurrentStepIndex('UnknownStep')).toBe(-1);
    });
  });

  describe('navigateToNextStep', () => {
    it('navigates to the next step in the list', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('CreateHome');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('CreateShoppingList'),
      );
      expect(mockSetOnBoardingStep).toHaveBeenCalledWith(
        OnBoardingSteps.createShoppingList,
      );
    });

    it('resets navigation stack when navigating to OnboardingComplete', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('BiometricSetup');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'OnboardingComplete' }],
        }),
      );
      expect(mockSetOnBoardingStep).toHaveBeenCalledWith(
        OnBoardingSteps.complete,
      );
    });

    it('does nothing if already on the last step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('OnboardingComplete');
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockSetOnBoardingStep).not.toHaveBeenCalled();
    });

    it('sets the correct enum for each step transition', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('CreateShoppingList');
      });

      expect(mockSetOnBoardingStep).toHaveBeenCalledWith(
        OnBoardingSteps.selectPantryItems,
      );
    });
  });

  describe('navigateToPreviousStep', () => {
    it('navigates to the previous step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToPreviousStep('CreateShoppingList');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('CreateHome'),
      );
      expect(mockSetOnBoardingStep).toHaveBeenCalledWith(
        OnBoardingSteps.createHome,
      );
    });

    it('does nothing when on the first step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToPreviousStep('CreateHome');
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockSetOnBoardingStep).not.toHaveBeenCalled();
    });
  });

  describe('skipToStep', () => {
    it('navigates directly to a valid step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.skipToStep('InviteMembers');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('InviteMembers'),
      );
      expect(mockSetOnBoardingStep).toHaveBeenCalledWith(
        OnBoardingSteps.inviteMembers,
      );
    });

    it('does nothing for an invalid step name', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.skipToStep('InvalidStep');
      });

      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockSetOnBoardingStep).not.toHaveBeenCalled();
    });
  });

  describe('completeOnboarding', () => {
    it('sets onboarded to true and clears onboarding step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      let returnVal: boolean | undefined;
      act(() => {
        returnVal = result.current.completeOnboarding();
      });

      expect(returnVal).toBe(true);
      expect(mockSetOnboarded).toHaveBeenCalledWith(true);
      expect(mockSetOnBoardingStep).toHaveBeenCalledWith(null);
    });

    it('tracks onboarding completion with timestamp', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.completeOnboarding();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: now,
      });

      jest.restoreAllMocks();
    });

    it('returns false when no user exists', () => {
      mockUser = null;
      const { result } = renderHook(() => useOnboardingNavigation());

      let returnVal: boolean | undefined;
      act(() => {
        returnVal = result.current.completeOnboarding();
      });

      expect(returnVal).toBe(false);
      expect(mockSetOnboarded).not.toHaveBeenCalled();
    });
  });

  describe('getProgressPercentage', () => {
    it('returns progress percentage based on current step', () => {
      mockGetState.mockReturnValue({
        routes: [{ name: 'CreateHome' }],
        index: 0,
      });

      const { result } = renderHook(() => useOnboardingNavigation());

      const progress = result.current.getProgressPercentage();
      // CreateHome is step 0 out of 7 steps, so (0+1)/7 * 100 = ~14
      expect(progress).toBe(Math.round((1 / 7) * 100));
    });

    it('returns 100 for the last step', () => {
      mockGetState.mockReturnValue({
        routes: [{ name: 'OnboardingComplete' }],
        index: 0,
      });

      const { result } = renderHook(() => useOnboardingNavigation());

      const progress = result.current.getProgressPercentage();
      expect(progress).toBe(100);
    });

    it('returns 0 for an unknown step', () => {
      mockGetState.mockReturnValue({
        routes: [{ name: 'UnknownScreen' }],
        index: 0,
      });

      const { result } = renderHook(() => useOnboardingNavigation());

      const progress = result.current.getProgressPercentage();
      expect(progress).toBe(0);
    });
  });

  it('exposes setUserNavigationState and getUserNavigationState', () => {
    const { result } = renderHook(() => useOnboardingNavigation());
    expect(result.current.setUserNavigationState).toBe(
      mockSetUserNavigationState,
    );
    expect(result.current.getUserNavigationState).toBe(
      mockGetUserNavigationState,
    );
  });
});
