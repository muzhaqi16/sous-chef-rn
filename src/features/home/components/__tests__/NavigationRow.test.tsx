import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { NavigationRow } from '#features/home/components/NavigationRow';

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: {
    selection: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
  },
}));

describe('NavigationRow', () => {
  const defaultProps = {
    icon: 'settings',
    title: 'Settings',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title text', () => {
    render(<NavigationRow {...defaultProps} />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(
      <NavigationRow {...defaultProps} subtitle="Manage your preferences" />,
    );
    expect(screen.getByText('Manage your preferences')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<NavigationRow {...defaultProps} />);
    expect(screen.queryByText('Manage your preferences')).toBeNull();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    render(<NavigationRow {...defaultProps} />);
    await user.press(screen.getByRole('button'));
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('has button accessibility role', () => {
    render(<NavigationRow {...defaultProps} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('builds correct accessibility label with subtitle', () => {
    render(<NavigationRow {...defaultProps} subtitle="More info" />);
    const button = screen.getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Settings, More info');
  });

  it('builds accessibility label from title only when no subtitle', () => {
    render(<NavigationRow {...defaultProps} />);
    const button = screen.getByRole('button');
    expect(button.props.accessibilityLabel).toBe('Settings');
  });
});
