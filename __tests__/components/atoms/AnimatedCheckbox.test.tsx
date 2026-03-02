'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AnimatedCheckbox } from '../../../src/components/atoms/AnimatedCheckbox';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('@shopify/flash-list', () => ({
  FlashList: require('react-native').FlatList,
  MasonryFlashList: require('react-native').FlatList,
  useRecyclingState: (initial: any) => {
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

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AnimatedCheckbox checked={false} onPress={onPress} testID="checkbox" />,
    );
    fireEvent.press(getByTestId('checkbox'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <AnimatedCheckbox
        checked={false}
        onPress={onPress}
        disabled
        testID="checkbox"
      />,
    );
    fireEvent.press(getByTestId('checkbox'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders checked state', () => {
    const { toJSON } = render(
      <AnimatedCheckbox checked={true} testID="checkbox" />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
