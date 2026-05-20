'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { Gesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { SpotlightCoachMark } from '../SpotlightCoachMark';

jest.mock('#hooks/settings/useSettings', () => ({
  useShowTutorials: () => true,
}));

const PanMock = Gesture.Pan as unknown as jest.Mock;
const scheduleOnRNMock = scheduleOnRN as unknown as jest.Mock;

const targetRect = { x: 100, y: 200, width: 50, height: 50 };

const getLatestPanGesture = () => {
  const results = PanMock.mock.results;
  return results[results.length - 1].value;
};

describe('SpotlightCoachMark swipe-to-advance gesture', () => {
  beforeEach(() => {
    PanMock.mockClear();
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
    expect(gesture.activeOffsetX).toHaveBeenCalledWith([-20, 20]);
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
    const onEnd = gesture.onEnd.mock.calls[0][0];

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
    const onEnd = gesture.onEnd.mock.calls[0][0];

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
    const onEnd = gesture.onEnd.mock.calls[0][0];

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
    expect(gesture.enabled).toHaveBeenCalledWith(false);
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
    expect(gesture.enabled).toHaveBeenCalledWith(false);
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
