import { renderHook, act } from '@testing-library/react-native';
import { CommonActions, StackActions } from '@react-navigation/native';
import {
  onboardingProgress,
  useOnboardingNavigation,
  visibleOnboardingSteps,
  type OnboardingStep,
} from '../useOnboardingNavigation';

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

let mockPantryId: string | null = 'pantry-1';
jest.mock('#store/useAppStore', () => ({
  useSelectedPantryId: () => mockPantryId,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockPantryId = 'pantry-1';
});

describe('useOnboardingNavigation', () => {
  describe('navigateToNextStep', () => {
    it('replaces setup with the first question, so back never returns to it', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('OnboardingSetup');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        StackActions.replace('Household'),
      );
    });

    it('resets navigation stack when navigating to OnboardingComplete', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('Receipt');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'OnboardingComplete' }],
        }),
      );
    });

    it("finishes a sub-route's step as the step itself", () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('OnboardingReceiptReview');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'OnboardingComplete' }],
        }),
      );
    });

    it('passes over the receipt step with no pantry to stock', () => {
      mockPantryId = null;
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('Dietary');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'OnboardingComplete' }],
        }),
      );
    });

    it('does nothing if already on the last step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('OnboardingComplete');
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('navigateToPreviousStep', () => {
    it('goes back to the previous question', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToPreviousStep('Receipt');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Dietary'),
      );
    });

    it('goes back from a sub-route to its own step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToPreviousStep('Staples');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Receipt'),
      );
    });

    it('never goes back to setup, which is not a question', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToPreviousStep('Household');
      });

      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });
});

describe('the visible sequence', () => {
  // A step shown only with a pantry, between two always shown.
  const steps: OnboardingStep[] = [
    { id: 'OnboardingSetup', numbered: true },
    {
      id: 'Receipt',
      numbered: true,
      shownWhen: ({ hasPantry }) => hasPantry,
    },
    { id: 'OnboardingComplete', numbered: true },
  ];

  it('passes over a hidden step and does not count it', () => {
    const context = { hasPantry: false };

    expect(visibleOnboardingSteps(context, steps).map(step => step.id)).toEqual(
      ['OnboardingSetup', 'OnboardingComplete'],
    );
    expect(onboardingProgress('OnboardingComplete', context, steps)).toEqual({
      step: 2,
      total: 2,
    });
  });

  it('counts the step once it is shown', () => {
    expect(
      onboardingProgress('OnboardingComplete', { hasPantry: true }, steps),
    ).toEqual({ step: 3, total: 3 });
  });

  it("numbers a sub-route as its step, so staples reads the receipt step's number", () => {
    const context = { hasPantry: true };

    expect(onboardingProgress('Staples', context)).toEqual(
      onboardingProgress('Receipt', context),
    );
    expect(onboardingProgress('Receipt', context)).toEqual({
      step: 3,
      total: 3,
    });
  });

  it('reads "Step 2 of 2" on the dietary step with no pantry', () => {
    expect(onboardingProgress('Dietary', { hasPantry: false })).toEqual({
      step: 2,
      total: 2,
    });
  });

  it('gives an unnumbered or unknown route no number', () => {
    // The real flow: setup and completion are not questions.
    expect(
      onboardingProgress('OnboardingSetup', { hasPantry: true }),
    ).toBeNull();
    expect(
      onboardingProgress('OnboardingComplete', { hasPantry: true }),
    ).toBeNull();
    expect(onboardingProgress('SomewhereElse', { hasPantry: true })).toBeNull();
  });
});
