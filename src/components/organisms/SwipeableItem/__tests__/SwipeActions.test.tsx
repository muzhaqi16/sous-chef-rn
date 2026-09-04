import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SwipeActions } from '#components/organisms/SwipeableItem/SwipeActions';
import { HapticService } from '#/services/haptic/HapticService';
import type { SwipeAction } from '#components/organisms/SwipeableItem/types';

jest.mock('#/services/haptic/HapticService', () => ({
  HapticService: { light: jest.fn() },
}));

jest.mock('#components/organisms/SwipeableItem/SwipeActionButton', () => ({
  SwipeActionButton: ({
    onPress,
    testID,
  }: {
    onPress: () => void;
    testID?: string;
  }) => {
    const { Pressable } = require('react-native');
    return require('react').createElement(Pressable, { onPress, testID });
  },
}));

const action = (over: Partial<SwipeAction> = {}): SwipeAction => ({
  key: 'consume',
  icon: 'create-outline',
  labelKey: 'labels.edit',
  onPress: jest.fn(),
  testID: 'action',
  ...over,
});

describe('SwipeActions haptics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('buzzes for an action that does not opt out', () => {
    render(<SwipeActions actions={[action()]} side="left" />);
    fireEvent.press(screen.getByTestId('action'));
    expect(HapticService.light).toHaveBeenCalledTimes(1);
  });

  it('stays silent for an action that opts out', () => {
    render(<SwipeActions actions={[action({ haptic: false })]} side="left" />);
    fireEvent.press(screen.getByTestId('action'));
    expect(HapticService.light).not.toHaveBeenCalled();
  });

  it('runs the action either way', () => {
    const onPress = jest.fn();
    render(
      <SwipeActions
        actions={[action({ haptic: false, onPress })]}
        side="left"
      />,
    );
    fireEvent.press(screen.getByTestId('action'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
