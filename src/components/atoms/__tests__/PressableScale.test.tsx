import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { PressableScale } from '../PressableScale';
import { Text } from '#components/atoms/Text';
import { HapticService } from '#services/haptic/HapticService';

describe('PressableScale', () => {
  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(
      <PressableScale onPress={onPress} testID="p">
        <Text>tap</Text>
      </PressableScale>,
    );
    fireEvent.press(screen.getByTestId('p'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire a haptic by default', () => {
    const light = jest.spyOn(HapticService, 'light');
    const medium = jest.spyOn(HapticService, 'medium');
    render(
      <PressableScale onPress={jest.fn()} testID="p">
        <Text>tap</Text>
      </PressableScale>,
    );
    fireEvent.press(screen.getByTestId('p'));
    expect(light).not.toHaveBeenCalled();
    expect(medium).not.toHaveBeenCalled();
    light.mockRestore();
    medium.mockRestore();
  });

  it('fires the requested haptic flavor on press', () => {
    const medium = jest.spyOn(HapticService, 'medium');
    render(
      <PressableScale haptic="medium" onPress={jest.fn()} testID="p">
        <Text>tap</Text>
      </PressableScale>,
    );
    fireEvent.press(screen.getByTestId('p'));
    expect(medium).toHaveBeenCalledTimes(1);
    medium.mockRestore();
  });

  it('forwards onPressIn / onPressOut', () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    render(
      <PressableScale
        onPress={jest.fn()}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID="p"
      >
        <Text>tap</Text>
      </PressableScale>,
    );
    fireEvent(screen.getByTestId('p'), 'pressIn');
    fireEvent(screen.getByTestId('p'), 'pressOut');
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });
});
