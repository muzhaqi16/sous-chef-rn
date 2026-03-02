'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LazyAnimatedCheckbox } from '../LazyAnimatedCheckbox';

jest.mock('#/apollo/links/tokenScheduler', () => ({ scheduleTokenRefresh: jest.fn(), cancelScheduledRefresh: jest.fn() }));
jest.mock('#/apollo/links/refreshToken', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('#utils/iconUtils', () => ({
  Icon: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock('#services/haptic/HapticService', () => ({
  HapticService: { light: jest.fn(), medium: jest.fn(), heavy: jest.fn(), selection: jest.fn() },
}));

describe('LazyAnimatedCheckbox', () => {
  it('renders unchecked state', () => {
    const { toJSON } = render(<LazyAnimatedCheckbox checked={false} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders checked state with checkmark icon', () => {
    render(<LazyAnimatedCheckbox checked={true} />);
    expect(screen.getByText('checkmark')).toBeTruthy();
  });

  it('does not show checkmark when unchecked', () => {
    render(<LazyAnimatedCheckbox checked={false} />);
    expect(screen.queryByText('checkmark')).toBeNull();
  });

  it('renders with custom size', () => {
    const { toJSON } = render(<LazyAnimatedCheckbox checked={true} size={32} />);
    expect(toJSON()).toBeTruthy();
  });
});
