import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import {
  ShoppingListTutorialProvider,
  ShoppingListTutorialStep,
  tutorialStepPosition,
  useShoppingListTutorialActions,
  useShoppingListTutorialState,
} from '../ShoppingListTutorialContext';

import { useStore } from '#store';

/** The hint record the store keeps, in the shape these assertions read. */
const hints = () => useStore.getState().featureHintsShown;

jest.mock('#store/useAppStore', () => ({
  useUserId: () => 'user-1',
  useShowTutorials: () => true,
}));

jest.mock('#hooks/ui/useTutorialResetSignal', () => ({
  useTutorialResetSignal: () => false,
}));

const mockPriceStep = jest.fn(() => true);
// The price step follows whether the list on screen asks for prices.
jest.mock('#features/shoppingList/hooks/useListAsksPrice', () => ({
  useListAsksPrice: () => mockPriceStep(),
}));

beforeEach(() => {
  useStore.getState().clearAllFeatureHints();
});

describe('ShoppingListTutorialProvider — screen-scoped completion', () => {
  it('records completion when the interactive tutorial is dismissed, without touching the global tutorials flag', () => {
    const { result } = renderHook(() => useShoppingListTutorialActions(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <ShoppingListTutorialProvider canStart={false}>
          {children}
        </ShoppingListTutorialProvider>
      ),
    });

    act(() => {
      result.current?.skipAll();
    });

    expect(
      hints()['feature_hint_shown_user-1_shopping_interactive_tutorial'],
    ).toBe(true);
    // Finishing/skipping the Shopping List tutorial must not disable
    // tutorials on other screens (e.g. Pantry, Recipes) — that's controlled
    // only by the user's "Show Tutorials" setting.
    expect(useStore.getState().showTutorials).toBe(true);
  });
});

describe('ShoppingListTutorialProvider — step sequence', () => {
  it('spotlights the long-press-price step between the checkbox and purchased-tab steps', () => {
    jest.useFakeTimers();

    const { result } = renderHook(
      () => ({
        state: useShoppingListTutorialState(),
        actions: useShoppingListTutorialActions(),
      }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ShoppingListTutorialProvider canStart>
            {children}
          </ShoppingListTutorialProvider>
        ),
      },
    );

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.state?.currentStep).toBe(
      ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON,
    );

    act(() => {
      result.current.actions?.skipCurrentStep(); // add button -> swipe actions
    });
    expect(result.current.state?.currentStep).toBe(
      ShoppingListTutorialStep.SPOTLIGHT_SWIPE_ACTIONS,
    );

    act(() => {
      result.current.actions?.skipCurrentStep(); // swipe actions -> checkbox
    });
    expect(result.current.state?.currentStep).toBe(
      ShoppingListTutorialStep.SPOTLIGHT_CHECKBOX,
    );

    act(() => {
      result.current.actions?.skipCurrentStep(); // checkbox -> long-press price
    });
    expect(result.current.state?.currentStep).toBe(
      ShoppingListTutorialStep.SPOTLIGHT_LONG_PRESS_PRICE,
    );

    act(() => {
      result.current.actions?.skipCurrentStep(); // long-press price -> purchased tab
    });
    expect(result.current.state?.currentStep).toBe(
      ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB,
    );

    jest.useRealTimers();
  });

  // Budget & prices off: nothing in the tour is about entering a price.
  it('goes from the checkbox straight to the purchased tab with prices off', () => {
    mockPriceStep.mockReturnValue(false);
    jest.useFakeTimers();

    const { result } = renderHook(
      () => ({
        state: useShoppingListTutorialState(),
        actions: useShoppingListTutorialActions(),
      }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <ShoppingListTutorialProvider canStart>
            {children}
          </ShoppingListTutorialProvider>
        ),
      },
    );
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    act(() => {
      result.current.actions?.skipCurrentStep(); // add button -> swipe actions
    });
    act(() => {
      result.current.actions?.skipCurrentStep(); // swipe actions -> checkbox
    });
    act(() => {
      result.current.actions?.notifyCheckboxTapped();
    });

    expect(result.current.state?.currentStep).toBe(
      ShoppingListTutorialStep.SPOTLIGHT_PURCHASED_TAB,
    );
    expect(result.current.state?.priceStep).toBe(false);

    jest.useRealTimers();
    mockPriceStep.mockReturnValue(true);
  });
});

describe('tutorialStepPosition', () => {
  it('counts the price step with prices on', () => {
    expect(tutorialStepPosition(6, true)).toEqual({
      stepIndex: 6,
      totalSteps: 8,
    });
  });

  it('closes the gap the price step leaves with prices off', () => {
    expect(tutorialStepPosition(4, false)).toEqual({
      stepIndex: 4,
      totalSteps: 7,
    });
    expect(tutorialStepPosition(6, false)).toEqual({
      stepIndex: 5,
      totalSteps: 7,
    });
  });
});

// Last in the file: the suppression is process-wide and has no undo.
describe('ShoppingListTutorialProvider — Detox suppression', () => {
  it('never starts once feature hints are suppressed for E2E', () => {
    jest.useFakeTimers();
    const { suppressFeatureHintsForE2E } = jest.requireActual<
      typeof import('#hooks/settings/useFeatureHint')
    >('#hooks/settings/useFeatureHint');
    suppressFeatureHintsForE2E();

    const { result } = renderHook(() => useShoppingListTutorialState(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <ShoppingListTutorialProvider canStart>
          {children}
        </ShoppingListTutorialProvider>
      ),
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current?.currentStep).not.toBe(
      ShoppingListTutorialStep.SPOTLIGHT_ADD_BUTTON,
    );
    jest.useRealTimers();
  });
});
