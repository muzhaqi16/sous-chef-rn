'use no memo';

import React from 'react';
import { StyleSheet } from 'react-native-unistyles';
import { fireEvent, render } from '@testing-library/react-native';
import { usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { SpotlightCoachMark } from '../SpotlightCoachMark';

jest.mock('#store/useAppStore', () => ({
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
  return results[results.length - 1]!.value;
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

describe('SpotlightCoachMark Skip', () => {
  // Skip sits in the card's action row: the card is kept clear of the hole and
  // on screen, where a floating Skip once landed on the header's buttons.
  const renderStep = (stepIndex: number | undefined, totalSteps?: number) => {
    const onDismiss = jest.fn();
    const utils = render(
      <SpotlightCoachMark
        targetRect={{ x: 8, y: 60, width: 160, height: 40 }}
        title="Tap to manage homes"
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        onDismiss={onDismiss}
        onNext={jest.fn()}
      />,
    );
    return { ...utils, onDismiss };
  };

  it('sits in the card, not over the screen', () => {
    const { getByRole } = renderStep(0, 3);
    const style = StyleSheet.flatten(
      getByRole('button', { name: 'Skip all' }).props.style,
    );
    expect(style.position).toBeUndefined();
  });

  // Named by what it shows, so a voice command that reads it reaches it.
  it('skips the whole sequence from a step that is not the last', () => {
    const { getByRole, onDismiss } = renderStep(0, 3);
    const skip = getByRole('button', { name: 'Skip all' });
    expect(skip.props.accessibilityHint).toBe('Skip tutorial');
    fireEvent.press(skip);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('reads Skip on a lone coach mark', () => {
    const { getByText } = renderStep(undefined);
    expect(getByText('Skip')).toBeTruthy();
  });

  it('leaves the last step to Done alone', () => {
    const { getByText, queryByText } = renderStep(2, 3);
    expect(getByText('Done')).toBeTruthy();
    expect(queryByText(/^Skip/)).toBeNull();
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
