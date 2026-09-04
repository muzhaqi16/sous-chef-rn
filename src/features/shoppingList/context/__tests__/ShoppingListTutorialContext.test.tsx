import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import {
  ShoppingListTutorialProvider,
  ShoppingListTutorialStep,
  useShoppingListTutorialActions,
  useShoppingListTutorialState,
} from '../ShoppingListTutorialContext';

jest.mock('#/storage/mmkv');

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
});
