'use no memo';

import React from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { AnimatedCheckbox } from '#features/shoppingList/components/AnimatedCheckbox';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('@shopify/flash-list', () => ({
  FlashList: require('react-native').FlatList,
  MasonryFlashList: require('react-native').FlatList,
  useRecyclingState: <T,>(initial: T | (() => T)) => {
    const { useState } = require('react');
    return useState(initial);
  },
}));
jest.mock('../../../src/services/haptic/HapticService', () => ({
  HapticService: { light: jest.fn() },
}));

describe('AnimatedCheckbox', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(
      <AnimatedCheckbox checked={false} testID="checkbox" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AnimatedCheckbox checked={false} onPress={onPress} testID="checkbox" />,
    );
    await user.press(getByTestId('checkbox'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AnimatedCheckbox
        checked={false}
        onPress={onPress}
        disabled
        testID="checkbox"
      />,
    );
    await user.press(getByTestId('checkbox'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders checked state', () => {
    const { toJSON } = render(
      <AnimatedCheckbox checked={true} testID="checkbox" />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
