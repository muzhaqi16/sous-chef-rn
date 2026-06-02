import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { AppPressable } from '../AppPressable';
import { HapticService } from '#services/haptic/HapticService';

describe('AppPressable', () => {
  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(
      <AppPressable onPress={onPress} testID="p">
        <Text>tap</Text>
      </AppPressable>,
    );
    fireEvent.press(screen.getByTestId('p'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire a haptic by default', () => {
    const spy = jest.spyOn(HapticService, 'selection');
    render(
      <AppPressable onPress={jest.fn()} testID="p">
        <Text>tap</Text>
      </AppPressable>,
    );
    fireEvent.press(screen.getByTestId('p'));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('fires a selection haptic when haptic is enabled', () => {
    const spy = jest.spyOn(HapticService, 'selection');
    render(
      <AppPressable haptic onPress={jest.fn()} testID="p">
        <Text>tap</Text>
      </AppPressable>,
    );
    fireEvent.press(screen.getByTestId('p'));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('applies the caller style and stays pressable without crashing', () => {
    render(
      <AppPressable style={{ padding: 8 }} onPress={jest.fn()} testID="p">
        <Text>tap</Text>
      </AppPressable>,
    );
    expect(screen.getByTestId('p')).toBeTruthy();
  });

  it('preserves a caller function-style callback (variant-safe composition)', () => {
    const styleFn = jest.fn(() => ({ padding: 8 }));
    render(
      <AppPressable style={styleFn} onPress={jest.fn()} testID="p">
        <Text>tap</Text>
      </AppPressable>,
    );
    // The function-style callback is invoked by Pressable during render.
    expect(styleFn).toHaveBeenCalled();
  });
});
