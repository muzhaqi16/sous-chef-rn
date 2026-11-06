import { renderHook, act } from '@testing-library/react-native';
import { CommonActions, StackActions } from '@react-navigation/native';
import {
  onboardingProgress,
  useOnboardingNavigation,
  useOnboardingStepContext,
  visibleOnboardingSteps,
  type OnboardingStep,
} from '../useOnboardingNavigation';
import {
  initialOnboardingProgress,
  useOnboardingProgressStore,
  useOnboardingSetupStore,
} from '#features/onboarding/store/onboardingProgressStore';

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
  useOnboardingProgressStore.setState({ ...initialOnboardingProgress });
  useOnboardingSetupStore.setState({ setup: { kind: 'reading' } });
});

describe('useOnboardingNavigation', () => {
  describe('navigateToNextStep', () => {
    it('replaces setup with the first question, so back never returns to it', async () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      // It first reads the stored progress, so the move follows a tick later.
      await act(async () => {
        result.current.navigateToNextStep('OnboardingSetup');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        StackActions.replace('Household'),
      );
    });

    it('reopens at the furthest question reached, the ones before it behind it', async () => {
      const { result } = renderHook(() => useOnboardingNavigation());
      await act(async () => {
        result.current.navigateToNextStep('Household');
      });
      mockDispatch.mockClear();

      // The app restarts: setup runs again before the questions.
      await act(async () => {
        result.current.navigateToNextStep('OnboardingSetup');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.reset({
          index: 1,
          routes: [{ name: 'Household' }, { name: 'Dietary' }],
        }),
      );
    });

    it('keeps the furthest question when the user goes back', async () => {
      const { result } = renderHook(() => useOnboardingNavigation());
      await act(async () => {
        result.current.navigateToNextStep('Dietary');
      });
      await act(async () => {
        result.current.navigateToNextStep('OnboardingSetup');
      });

      expect(useOnboardingProgressStore.getState().reachedStep).toBe('Receipt');
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
      // Setup finished without a home: the user joins one by an invitation.
      mockPantryId = null;
      useOnboardingSetupStore.setState({ setup: { kind: 'done' } });
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

    it('keeps the receipt step while setup is still making the pantry', () => {
      mockPantryId = null;
      useOnboardingSetupStore.setState({
        setup: { kind: 'running', createMissingHome: true },
      });
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToNextStep('Dietary');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Receipt'),
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
        CommonActions.navigate('Dietary', undefined, { pop: true }),
      );
    });

    it('goes back from a sub-route to its own step', () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateToPreviousStep('OnboardingReceiptReview');
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Receipt', undefined, { pop: true }),
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

  describe('navigateWithinStep', () => {
    it("opens the store picker for the user's home", () => {
      const { result } = renderHook(() => useOnboardingNavigation());

      act(() => {
        result.current.navigateWithinStep('OnboardingStores', {
          homeId: 'home-1',
        });
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('OnboardingStores', { homeId: 'home-1' }),
      );
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

  it("numbers a sub-route as its step, so the scanner reads the receipt step's number", () => {
    const context = { hasPantry: true };

    expect(onboardingProgress('OnboardingReceiptScan', context)).toEqual(
      onboardingProgress('Receipt', context),
    );
    expect(onboardingProgress('Receipt', context)).toEqual({
      step: 3,
      total: 3,
    });
  });

  it('reads "of 3" before setup has made the pantry', () => {
    mockPantryId = null;
    const reading = renderHook(() => useOnboardingStepContext());
    expect(onboardingProgress('Household', reading.result.current)).toEqual({
      step: 1,
      total: 3,
    });

    act(() => {
      useOnboardingSetupStore.setState({
        setup: { kind: 'running', createMissingHome: true },
      });
    });
    expect(onboardingProgress('Dietary', reading.result.current)).toEqual({
      step: 2,
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
    expect(
      onboardingProgress('OnboardingStores', { hasPantry: true }),
    ).toBeNull();
    expect(onboardingProgress('SomewhereElse', { hasPantry: true })).toBeNull();
  });
});
