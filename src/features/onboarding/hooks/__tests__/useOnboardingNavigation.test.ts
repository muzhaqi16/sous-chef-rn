import { renderHook, act } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { useOnboardingNavigation } from '../useOnboardingNavigation';
import { OnBoardingSteps } from '#store/slices/navigationSlice';

// Break circular dependency chain
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockDispatch = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      dispatch: mockDispatch,
    }),
  };
});

const mockSetOnBoardingStep = jest.fn();
const mockSetUserNavigationState = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useNavigationUtils: jest.fn(() => ({
    setUserNavigationState: mockSetUserNavigationState,
    setOnBoardingStep: mockSetOnBoardingStep,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useOnboardingNavigation', () => {
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
  });

  it('exposes setUserNavigationState', () => {
    const { result } = renderHook(() => useOnboardingNavigation());
    expect(result.current.setUserNavigationState).toBe(
      mockSetUserNavigationState,
    );
  });
});
