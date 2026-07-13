'use no memo';

import React from 'react';
import { Dimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { render } from '@testing-library/react-native';
import { usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { SpotlightCoachMark } from '../SpotlightCoachMark';

jest.mock('#hooks/settings/useSettings', () => ({
  useShowTutorials: () => true,
}));

const usePanGestureMock = usePanGesture as unknown as jest.Mock;
const scheduleOnRNMock = scheduleOnRN as unknown as jest.Mock;

const targetRect = { x: 100, y: 200, width: 50, height: 50 };

// Each render calls usePanGesture(config); the mock returns the config, so the
// latest result carries the gesture's props (activeOffsetX, enabled) + the
// onDeactivate callback.
const getLatestPanGesture = () => {
  const results = usePanGestureMock.mock.results;
  return results[results.length - 1].value;
};

describe('SpotlightCoachMark swipe-to-advance gesture', () => {
  beforeEach(() => {
    usePanGestureMock.mockClear();
    scheduleOnRNMock.mockClear();
  });

  it('configures the gesture with horizontal activation thresholds', () => {
    render(
      <SpotlightCoachMark
        targetRect={targetRect}
        title="Step 1"
        stepIndex={0}
        totalSteps={3}
        onDismiss={jest.fn()}
        onNext={jest.fn()}
      />,
    );
    const gesture = getLatestPanGesture();
    expect(gesture.activeOffsetX).toEqual([-20, 20]);
  });

  it('advances on left-swipe past threshold when onNext is provided', () => {
    const onNext = jest.fn();
    render(
      <SpotlightCoachMark
        targetRect={targetRect}
        title="Step 1"
        stepIndex={0}
        totalSteps={3}
        onDismiss={jest.fn()}
        onNext={onNext}
      />,
    );
    const gesture = getLatestPanGesture();
    const onEnd = gesture.onDeactivate;

    onEnd({ translationX: -80, translationY: 0 });

    expect(scheduleOnRNMock).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('does not advance on right-swipe', () => {
    const onNext = jest.fn();
    render(
      <SpotlightCoachMark
        targetRect={targetRect}
        title="Step 1"
        stepIndex={0}
        totalSteps={3}
        onDismiss={jest.fn()}
        onNext={onNext}
      />,
    );
    const gesture = getLatestPanGesture();
    const onEnd = gesture.onDeactivate;

    onEnd({ translationX: 100, translationY: 0 });

    expect(scheduleOnRNMock).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('does not advance on left-swipe below threshold', () => {
    const onNext = jest.fn();
    render(
      <SpotlightCoachMark
        targetRect={targetRect}
        title="Step 1"
        stepIndex={0}
        totalSteps={3}
        onDismiss={jest.fn()}
        onNext={onNext}
      />,
    );
    const gesture = getLatestPanGesture();
    const onEnd = gesture.onDeactivate;

    onEnd({ translationX: -30, translationY: 0 });

    expect(scheduleOnRNMock).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('disables the gesture when onNext is not provided (last step)', () => {
    render(
      <SpotlightCoachMark
        targetRect={targetRect}
        title="Done"
        stepIndex={2}
        totalSteps={3}
        onDismiss={jest.fn()}
      />,
    );
    const gesture = getLatestPanGesture();
    expect(gesture.enabled).toBe(false);
  });

  it('disables the gesture in passthrough mode', () => {
    render(
      <SpotlightCoachMark
        targetRect={targetRect}
        title="Step 1"
        stepIndex={0}
        totalSteps={3}
        onDismiss={jest.fn()}
        onNext={jest.fn()}
        allowGesturePassthrough
      />,
    );
    const gesture = getLatestPanGesture();
    expect(gesture.enabled).toBe(false);
  });
});

describe('SpotlightCoachMark skip button placement', () => {
  // The skip button defaults to the top-right corner. When the spotlight
  // hole sits near the top of the screen, the button moves to whichever
  // top corner is farther from the hole's center.

  const { width: screenWidth } = Dimensions.get('window');

  const getSkipStyle = (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const { getByLabelText } = render(
      <SpotlightCoachMark
        targetRect={rect}
        title="Step 1"
        stepIndex={0}
        totalSteps={3}
        onDismiss={jest.fn()}
        onNext={jest.fn()}
      />,
    );
    return StyleSheet.flatten(getByLabelText('Skip tutorial').props.style);
  };

  it('stays top-right for a wide left-anchored target near the top', () => {
    // Regression: a wide home badge whose right edge barely crosses the
    // screen midpoint must NOT pull the skip button onto itself at the left.
    const style = getSkipStyle({
      x: 8,
      y: 60,
      width: screenWidth / 2 + 20,
      height: 56,
    });
    expect(style.left).toBeUndefined();
    expect(style.right).toBeGreaterThan(0);
  });

  it('moves to the top-left when the target sits in the top-right corner', () => {
    const style = getSkipStyle({
      x: screenWidth - 60,
      y: 60,
      width: 40,
      height: 40,
    });
    expect(style.left).toBeGreaterThan(0);
    expect(style.right).toBeUndefined();
  });

  it('stays top-right when a right-side target is not near the top', () => {
    const style = getSkipStyle({
      x: screenWidth - 60,
      y: 400,
      width: 40,
      height: 40,
    });
    expect(style.left).toBeUndefined();
    expect(style.right).toBeGreaterThan(0);
  });
});

describe('SpotlightCoachMark degenerate-rect guard', () => {
  // Returns null when width/height is 0 — the actual repro for "stuck
  // dim with no hole" the guard is here to prevent.

  it('renders nothing when the rect has zero width', () => {
    const { toJSON } = render(
      <SpotlightCoachMark
        targetRect={{ x: 100, y: 200, width: 0, height: 50 }}
        title="X"
        onDismiss={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when the rect has zero height', () => {
    const { toJSON } = render(
      <SpotlightCoachMark
        targetRect={{ x: 100, y: 200, width: 50, height: 0 }}
        title="X"
        onDismiss={jest.fn()}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders the overlay when the rect is valid', () => {
    const { toJSON } = render(
      <SpotlightCoachMark
        targetRect={{ x: 100, y: 200, width: 50, height: 50 }}
        title="X"
        onDismiss={jest.fn()}
      />,
    );
    expect(toJSON()).not.toBeNull();
  });
});
