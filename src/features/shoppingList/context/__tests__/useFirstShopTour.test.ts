import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import type { TargetRect } from '#components/organisms/SpotlightCoachMark/SpotlightCoachMark';
import { useStore } from '#store';
import { emitTutorialEvent } from '#domain/tutorialEvents';
import {
  startTutorialSession,
  tutorialSession,
} from '#hooks/ui/tutorialSession';
import { GUIDE_TOURS } from '#domain/guides';
import { hasFeatureHintBeenShown } from '#hooks/settings/useFeatureHint';
import { featureHintKey } from '#store/slices/tutorialSlice';
import { FIRST_SHOP_STEP, useFirstShopTour } from '../useFirstShopTour';
import {
  FirstShopTourProvider,
  useFirstShopTourContext,
} from '../FirstShopTourContext';

jest.mock('#store/useAppStore', () => ({
  useUserId: () => 'user-1',
  useShowTutorials: () => true,
  useAppStore: (select: (state: unknown) => unknown) =>
    select(jest.requireActual('#store').useStore.getState()),
}));

jest.mock('#components/providers/OverlayBackdropProvider', () => ({
  useOverlayBackdropPresence: () => false,
}));

const rect: TargetRect = { x: 0, y: 0, width: 40, height: 40 };

type Input = Parameters<typeof useFirstShopTour>[0];
const baseInput: Input = {
  hasList: true,
  unpurchasedCount: 0,
  hasPurchasedToMove: false,
  addButtonRect: rect,
  isPaused: false,
  startDelay: 0,
};

const renderTour = (input: Partial<Input> = {}) =>
  renderHook((props: Input) => useFirstShopTour(props), {
    initialProps: { ...baseInput, ...input },
  });

beforeEach(() => {
  useStore.setState({ featureHintsShown: {}, lastUnpromptedTipAt: {} });
  startTutorialSession();
});

describe('useFirstShopTour', () => {
  it('The shopping guide: four tips or fewer, from + to putting away', () => {
    const shown = new Set<string>();
    const { result, rerender } = renderTour();
    const note = () => {
      const { currentStep, inlineStep } = result.current.guide;
      if (currentStep) shown.add(currentStep.featureId);
      if (inlineStep) shown.add(inlineStep.title);
    };

    note();
    expect(result.current.guide.currentStep?.featureId).toBe(
      FIRST_SHOP_STEP.add,
    );
    act(() => result.current.guide.advanceInPlace());

    note();
    expect(result.current.guide.inlineStep).not.toBeNull();
    act(() => emitTutorialEvent('list.itemAdded'));

    rerender({ ...baseInput, unpurchasedCount: 1 });
    act(() => result.current.registerRect('checkbox', rect));
    note();
    expect(result.current.guide.currentStep?.featureId).toBe(
      FIRST_SHOP_STEP.check,
    );
    act(() => result.current.guide.advanceInPlace());

    rerender({ ...baseInput, hasPurchasedToMove: true });
    expect(result.current.tabForGuide).toBe('purchased');
    act(() => result.current.noteTab('purchased'));
    act(() => result.current.registerRect('archiveIcon', rect));
    note();
    expect(result.current.guide.currentStep?.featureId).toBe(
      FIRST_SHOP_STEP.putAway,
    );
    act(() => emitTutorialEvent('list.movedToPantry'));

    expect(result.current.guide.currentStep).toBeNull();
    expect(shown.size).toBeLessThanOrEqual(4);
    for (const featureId of Object.values(FIRST_SHOP_STEP)) {
      expect(hasFeatureHintBeenShown(featureId, 'user-1')).toBe(true);
    }
  });

  it('Adding manually: an item added outside the suggestions continues the guide', () => {
    const { result } = renderTour();
    act(() => result.current.guide.advanceInPlace());
    expect(result.current.guide.inlineStep).not.toBeNull();

    // Every add path's writer emits this, "Add manually" included.
    act(() => emitTutorialEvent('list.itemAdded'));

    expect(result.current.guide.inlineStep).toBeNull();
    expect(hasFeatureHintBeenShown(FIRST_SHOP_STEP.pick, 'user-1')).toBe(true);
  });

  it('asks the first row for each target before its tip shows, so it registers in time', () => {
    useStore.setState({
      featureHintsShown: {
        [featureHintKey('user-1', FIRST_SHOP_STEP.add)]: true,
        [featureHintKey('user-1', FIRST_SHOP_STEP.pick)]: true,
      },
    });
    const { result, rerender } = renderTour({ unpurchasedCount: 1 });

    expect(result.current.guide.currentStep).toBeNull();
    expect(result.current.wanted.checkbox).toBe(true);
    act(() => result.current.registerRect('checkbox', rect));
    expect(result.current.guide.currentStep?.featureId).toBe(
      FIRST_SHOP_STEP.check,
    );

    act(() => result.current.guide.advanceInPlace());
    expect(result.current.tabForGuide).toBeNull();
    rerender({ ...baseInput, hasPurchasedToMove: true });
    expect(result.current.tabForGuide).toBe('purchased');
    // Off screen until Purchased shows, so not measured before then.
    expect(result.current.wanted.archiveIcon).toBe(false);
    act(() => result.current.noteTab('purchased'));
    expect(result.current.wanted.archiveIcon).toBe(true);
  });

  it('Closing the app mid-tour: it resumes at the step reached, not done', () => {
    const first = renderTour();
    act(() => first.result.current.guide.advanceInPlace());
    act(() => emitTutorialEvent('list.itemAdded'));
    first.unmount();

    const again = renderTour({ unpurchasedCount: 1 });
    act(() => again.result.current.registerRect('checkbox', rect));

    expect(again.result.current.guide.currentStep?.featureId).toBe(
      FIRST_SHOP_STEP.check,
    );
    expect(hasFeatureHintBeenShown(FIRST_SHOP_STEP.putAway, 'user-1')).toBe(
      false,
    );
  });

  it('shows the swipe tip once the list holds three items and the guide is done', () => {
    useStore.setState({
      featureHintsShown: Object.fromEntries(
        Object.values(FIRST_SHOP_STEP).map(id => [
          featureHintKey('user-1', id),
          true,
        ]),
      ),
    });
    const { result, rerender } = renderTour({ unpurchasedCount: 2 });
    expect(result.current.wanted.itemCard).toBe(false);

    rerender({ ...baseInput, unpurchasedCount: 3 });
    act(() => result.current.noteTab('purchased'));
    expect(result.current.wanted.itemCard).toBe(false);
    act(() => result.current.noteTab('shopping'));
    expect(result.current.wanted.itemCard).toBe(true);
    act(() => result.current.registerRect('itemCard', rect));

    expect(result.current.swipeTip.currentStep?.demo).toBe('swipe');
  });

  it('counts a row swiped open as the swipe tip done', () => {
    useStore.setState({
      featureHintsShown: Object.fromEntries(
        Object.values(FIRST_SHOP_STEP).map(id => [
          featureHintKey('user-1', id),
          true,
        ]),
      ),
    });
    const { result } = renderHook(() => useFirstShopTourContext(), {
      wrapper: ({ children }: { children: React.ReactNode }) =>
        React.createElement(FirstShopTourProvider, {
          ...baseInput,
          unpurchasedCount: 3,
          children,
        }),
    });
    act(() => result.current?.registerRect('itemCard', rect));
    expect(result.current?.swipeTip.currentStep).not.toBeNull();

    act(() => emitTutorialEvent('list.rowSwiped'));

    expect(hasFeatureHintBeenShown('shopping_list_swipe', 'user-1')).toBe(true);
  });

  it('Shop from your list: started from the card, it shows how to add an item, waiting until one is', () => {
    useStore.setState({
      featureHintsShown: {
        [featureHintKey('user-1', 'shopping_interactive_tutorial')]: true,
      },
    });
    act(() => tutorialSession.startGuide(GUIDE_TOURS.shop));
    const { result } = renderTour();

    expect(result.current.guide.currentStep?.featureId).toBe(
      FIRST_SHOP_STEP.add,
    );
    act(() => result.current.guide.advanceInPlace());
    expect(result.current.guide.inlineStep).not.toBeNull();
    act(() => tutorialSession.endGuide(GUIDE_TOURS.shop));
  });

  it('walks no one through the list again who finished its earlier tutorial', () => {
    useStore.setState({
      featureHintsShown: {
        [featureHintKey('user-1', 'shopping_interactive_tutorial')]: true,
      },
    });

    const { result } = renderTour();

    expect(result.current.guide.currentStep).toBeNull();
  });
});
