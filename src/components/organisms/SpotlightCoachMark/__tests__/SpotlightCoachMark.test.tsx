'use no memo';

import React from 'react';
import { AccessibilityInfo, Dimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { usePanGesture } from 'react-native-gesture-handler';
import { withRepeat } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { kitTestIDs } from '#components/testIDs';
import { requirePlatform } from '#platform/install';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { SpotlightCoachMark, type TargetRect } from '../SpotlightCoachMark';
import { DEMO_REPEATS } from '../spotlightConstants';

jest.mock('#hooks/animations/useMotionEnabled', () => ({
  useMotionEnabled: jest.fn(() => true),
}));

const usePanGestureMock = usePanGesture as unknown as jest.Mock;
const scheduleOnRNMock = scheduleOnRN as unknown as jest.Mock;
const insetsMock = useSafeAreaInsets as jest.Mock;

const targetRect = { x: 100, y: 200, width: 50, height: 50 };

// Each render calls usePanGesture(config); the mock returns the config, so the
// latest result carries the gesture's props (activeOffsetX, enabled) + the
// onDeactivate callback.
const getLatestPanGesture = () => {
  const results = usePanGestureMock.mock.results;
  return results[results.length - 1]!.value;
};

const renderMark = (
  props: Partial<React.ComponentProps<typeof SpotlightCoachMark>> = {},
) => {
  const onDismiss = jest.fn();
  const onClose = jest.fn();
  const onNext = jest.fn();
  const utils = render(
    <SpotlightCoachMark
      targetRect={{ x: 8, y: 60, width: 160, height: 40 }}
      title="Tap to manage homes"
      subtitle="Switch between the homes you belong to."
      stepIndex={0}
      totalSteps={3}
      onDismiss={onDismiss}
      onClose={onClose}
      onNext={onNext}
      {...props}
    />,
  );
  return { ...utils, onDismiss, onClose, onNext };
};

/** The card's frame once laid out, as a screen measures it. */
const layOutCard = (height: number) => {
  const card = screen.UNSAFE_root.findAll(
    node =>
      typeof node.props.onLayout === 'function' &&
      node.props.style !== undefined &&
      StyleSheet.flatten(node.props.style).position === 'absolute',
  )[0]!;
  act(() => {
    card.props.onLayout({ nativeEvent: { layout: { height } } });
  });
  return () => StyleSheet.flatten(card.props.style);
};

/** A gesture step's overlay, measured inside a screen 100 pt down. */
const layOutOverlay = async () => {
  const overlay = screen.UNSAFE_root.findAll(
    node => typeof node.props.onLayout === 'function',
  )[0]!;
  jest
    .spyOn(overlay.instance, 'measure')
    .mockImplementation((...args: unknown[]) => {
      const [done] = args;
      if (typeof done === 'function') done(0, 0, 390, 700, 0, 100);
    });
  await act(async () => {
    overlay.props.onLayout();
    await new Promise(requestAnimationFrame);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  insetsMock.mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
  (useMotionEnabled as jest.Mock).mockReturnValue(true);
});

describe('SpotlightCoachMark swipe-to-advance gesture', () => {
  it('configures the gesture with horizontal activation thresholds', () => {
    renderMark({ targetRect });
    expect(getLatestPanGesture().activeOffsetX).toEqual([-20, 20]);
  });

  it('advances on left-swipe past threshold when onNext is provided', () => {
    const { onNext } = renderMark({ targetRect });

    getLatestPanGesture().onDeactivate({ translationX: -80, translationY: 0 });

    expect(scheduleOnRNMock).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('does not advance on right-swipe', () => {
    const { onNext } = renderMark({ targetRect });

    getLatestPanGesture().onDeactivate({ translationX: 100, translationY: 0 });

    expect(onNext).not.toHaveBeenCalled();
  });

  it('does not advance on left-swipe below threshold', () => {
    const { onNext } = renderMark({ targetRect });

    getLatestPanGesture().onDeactivate({ translationX: -30, translationY: 0 });

    expect(onNext).not.toHaveBeenCalled();
  });

  it('disables the gesture when onNext is not provided (last step)', () => {
    renderMark({ targetRect, stepIndex: 2, onNext: undefined });
    expect(getLatestPanGesture().enabled).toBe(false);
  });

  it('disables the gesture in passthrough mode', () => {
    renderMark({ targetRect, allowGesturePassthrough: true });
    expect(getLatestPanGesture().enabled).toBe(false);
  });

  it('disables the gesture on a step that waits for the user', () => {
    renderMark({ targetRect, waitsForAction: true });
    expect(getLatestPanGesture().enabled).toBe(false);
  });
});

describe('SpotlightCoachMark controls', () => {
  it('Not now closes only this tip', () => {
    const { onClose, onDismiss } = renderMark();

    fireEvent.press(screen.getByRole('button', { name: 'Not now' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('End tour ends a tour of several steps', () => {
    const { onDismiss } = renderMark();

    fireEvent.press(screen.getByRole('button', { name: 'End tour' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Next is the filled button, and progress reads "1 of 3"', () => {
    const { onNext } = renderMark();

    expect(screen.getByText('1 of 3')).toBeTruthy();
    fireEvent.press(screen.getByTestId(kitTestIDs.spotlightPrimaryButton));

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('A one-step tip: a control that closes it, and none to end a tour', () => {
    const { onDismiss } = renderMark({
      stepIndex: undefined,
      totalSteps: undefined,
    });

    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'End tour' })).toBeNull();
    expect(screen.queryByText(/ of /)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ends on Got it at the last step, with no End tour beside it', () => {
    renderMark({ stepIndex: 2 });

    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'End tour' })).toBeNull();
  });

  it('offers no Next on a step that waits for the user', () => {
    renderMark({ waitsForAction: true });

    expect(screen.queryByTestId(kitTestIDs.spotlightPrimaryButton)).toBeNull();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
  });

  it('gives Not now and End tour a 44 pt target', () => {
    renderMark();

    for (const name of ['Not now', 'End tour']) {
      const style = StyleSheet.flatten(
        screen.getByRole('button', { name }).props.style,
      );
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('Tapping outside a tip or pressing back is Not now', () => {
  it('A stray tap on the dim closes the tip without ending the tour', () => {
    const { onClose, onDismiss } = renderMark({ stepIndex: 1, totalSteps: 4 });

    fireEvent.press(screen.getByTestId(kitTestIDs.spotlightDim));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('on a gesture step, every side of the dim is Not now and the row stays open to touch', async () => {
    const { onClose } = renderMark({ allowGesturePassthrough: true });
    await layOutOverlay();

    const strips = screen.getAllByTestId(kitTestIDs.spotlightDim);
    expect(strips).toHaveLength(4);
    for (const strip of strips) fireEvent.press(strip);
    expect(onClose).toHaveBeenCalledTimes(4);
    expect(screen.queryByTestId(kitTestIDs.spotlightTarget)).toBeNull();
  });

  it('Android back closes the tip', () => {
    const { onClose, onDismiss } = renderMark();
    const modal = screen.UNSAFE_root.findAll(
      node => typeof node.props.onRequestClose === 'function',
    )[0]!;

    act(() => {
      modal.props.onRequestClose();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('Screen readers are taken to the tip', () => {
  it('VoiceOver on: focus moves to the tip, which reads its title and text', () => {
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent');
    renderMark();

    const text = screen.getByLabelText(
      '1 of 3. Tap to manage homes. Switch between the homes you belong to.',
    );
    expect(focus).toHaveBeenCalledWith(expect.anything(), 'focus');
    expect(text).toBeTruthy();
  });

  it('keeps the controls behind out of reach on a step that covers the screen', () => {
    renderMark();
    const modalRoot = screen.UNSAFE_root.findAll(
      node => node.props.accessibilityViewIsModal === true,
    );
    expect(modalRoot.length).toBeGreaterThan(0);
  });

  it('A gesture step is also spoken, as the screen stays reachable', async () => {
    const announce = jest.spyOn(requirePlatform('screenReader'), 'announce');
    renderMark({ allowGesturePassthrough: true, demo: 'swipe' });
    await layOutOverlay();

    expect(announce).toHaveBeenCalledWith(
      '1 of 3. Tap to manage homes. Switch between the homes you belong to.',
    );
  });

  it('Escape: the tip closes as if Not now were tapped', () => {
    const { onClose, onDismiss } = renderMark();
    const card = screen.UNSAFE_root.findAll(
      node => typeof node.props.onAccessibilityEscape === 'function',
    )[0]!;

    act(() => {
      card.props.onAccessibilityEscape();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('A gesture tip shows the gesture', () => {
  // The hand is hidden from screen readers: the tip's text names the actions.
  const hidden = { includeHiddenElements: true };

  it('The swipe tip shows the gesture at most three times', () => {
    renderMark({ demo: 'swipe' });

    expect(
      screen.getByTestId(kitTestIDs.spotlightGestureDemo, hidden),
    ).toBeTruthy();
    expect(withRepeat).toHaveBeenCalledWith(
      expect.anything(),
      DEMO_REPEATS,
      false,
    );
    expect(DEMO_REPEATS).toBeLessThanOrEqual(3);
  });

  it('Reduce Motion: the gesture shows without movement', () => {
    (useMotionEnabled as jest.Mock).mockReturnValue(false);
    renderMark({ demo: 'swipe' });

    expect(
      screen.getByTestId(kitTestIDs.spotlightGestureDemo, hidden),
    ).toBeTruthy();
    expect(withRepeat).not.toHaveBeenCalledWith(
      expect.anything(),
      DEMO_REPEATS,
      false,
    );
  });

  it('shows no hand on a tip that teaches no gesture', () => {
    renderMark();
    expect(
      screen.queryByTestId(kitTestIDs.spotlightGestureDemo, hidden),
    ).toBeNull();
  });
});

describe('Moving to the next step keeps the overlay', () => {
  it('Next: the highlight travels and the dim stays on throughout', () => {
    const { rerender, onDismiss, onClose } = renderMark();
    const next = { x: 200, y: 400, width: 80, height: 40 };

    rerender(
      <SpotlightCoachMark
        targetRect={next}
        title="Your pantries"
        stepIndex={1}
        totalSteps={3}
        onDismiss={onDismiss}
        onClose={onClose}
      />,
    );

    expect(screen.getByTestId(kitTestIDs.spotlightDim)).toBeTruthy();
    expect(screen.getByText('2 of 3')).toBeTruthy();
    const hole = StyleSheet.flatten(
      screen.getByTestId(kitTestIDs.spotlightTarget).props.style,
    );
    expect(hole).toMatchObject({ top: 392, left: 192, width: 96, height: 56 });
  });
});

describe('the card stays on screen', () => {
  const { height: windowHeight } = Dimensions.get('window');

  it('Large text: the controls stay inside the safe area', () => {
    insetsMock.mockReturnValue({ top: 47, bottom: 34, left: 0, right: 0 });
    renderMark({
      targetRect: { x: 20, y: windowHeight - 140, width: 200, height: 60 },
    });

    const style = layOutCard(windowHeight * 0.7);

    expect(style().top).toBeGreaterThanOrEqual(47 + 16);
    expect(Number(style().top) + windowHeight * 0.7).toBeLessThanOrEqual(
      windowHeight - 34 - 16,
    );
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
  });

  it('A header target: the card sits below it, clear of the header', () => {
    renderMark({ targetRect: { x: 8, y: 60, width: 160, height: 40 } });

    const style = layOutCard(180);

    expect(style().top).toBeGreaterThan(60 + 40);
  });

  it('A target near the bottom: the card sits above it', () => {
    renderMark({
      targetRect: { x: 300, y: windowHeight - 100, width: 56, height: 56 },
    });

    const style = layOutCard(180);

    expect(Number(style().top) + 180).toBeLessThan(windowHeight - 100);
  });
});

describe('SpotlightCoachMark holes', () => {
  it('cuts a round hole for a round target', () => {
    const round: TargetRect = {
      x: 300,
      y: 700,
      width: 56,
      height: 56,
      shape: 'round',
    };
    renderMark({ targetRect: round });

    const hole = StyleSheet.flatten(
      screen.getByTestId(kitTestIDs.spotlightTarget).props.style,
    );
    expect(hole.width).toBe(72);
    expect(hole.height).toBe(72);
    expect(hole.borderRadius).toBe(36);
  });
});

describe('SpotlightCoachMark degenerate-rect guard', () => {
  // Returns null when width/height is 0 — the actual repro for "stuck
  // dim with no hole" the guard is here to prevent.
  it('renders nothing when the rect has zero width', () => {
    const { toJSON } = renderMark({
      targetRect: { x: 100, y: 200, width: 0, height: 50 },
    });
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when the rect has zero height', () => {
    const { toJSON } = renderMark({
      targetRect: { x: 100, y: 200, width: 50, height: 0 },
    });
    expect(toJSON()).toBeNull();
  });

  it('renders the overlay when the rect is valid', () => {
    const { toJSON } = renderMark({ targetRect });
    expect(toJSON()).not.toBeNull();
  });
});
