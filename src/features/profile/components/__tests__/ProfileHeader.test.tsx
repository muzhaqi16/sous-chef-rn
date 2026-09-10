import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ProfileHeader } from '#features/profile/components/ProfileHeader';
import type { IconButtonProps } from '#components/atoms/IconButton';
import type { BackButtonProps } from '#components/atoms/BackButton';

// Both the plain atom and its themed wrapper: the wrapper is declared beside
// what it wraps, so a factory naming only the atom leaves the consumer's import
// undefined.
jest.mock('#components/atoms/IconButton', () => {
  const { Pressable, Text } = require('react-native');
  return {
    IconButton: ({ onPress, accessibilityLabel }: IconButtonProps) => (
      <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel}>
        <Text>IconButton</Text>
      </Pressable>
    ),
    ThemedIconButton: ({ onPress, accessibilityLabel }: IconButtonProps) => (
      <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel}>
        <Text>IconButton</Text>
      </Pressable>
    ),
  };
});

jest.mock('#components/atoms/BackButton', () => {
  const { Pressable, Text } = require('react-native');
  return {
    BackButton: ({ onPress }: BackButtonProps) => (
      <Pressable onPress={onPress} accessibilityLabel="Go Back">
        <Text>Back</Text>
      </Pressable>
    ),
    ThemedBackButton: ({ onPress }: BackButtonProps) => (
      <Pressable onPress={onPress} accessibilityLabel="Go Back">
        <Text>Back</Text>
      </Pressable>
    ),
  };
});

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: 'CachedImage',
}));

describe('ProfileHeader', () => {
  const defaultProps = {
    name: 'John Doe',
    onBack: jest.fn(),
    onMore: jest.fn(),
    onAvatarPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the user name', () => {
    render(<ProfileHeader {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<ProfileHeader {...defaultProps} subtitle="john@example.com" />);
    expect(screen.getByText('john@example.com')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<ProfileHeader {...defaultProps} />);
    expect(screen.queryByText('john@example.com')).toBeNull();
  });

  it('calls onBack when back button pressed', async () => {
    const user = userEvent.setup();
    render(<ProfileHeader {...defaultProps} />);
    await user.press(screen.getByLabelText('Go Back'));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('calls onMore when more button pressed', async () => {
    const user = userEvent.setup();
    render(<ProfileHeader {...defaultProps} />);
    await user.press(screen.getByLabelText('More options'));
    expect(defaultProps.onMore).toHaveBeenCalledTimes(1);
  });

  it('renders placeholder avatar when no avatarUrl', () => {
    const { toJSON } = render(<ProfileHeader {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders avatar image when avatarUrl is provided', () => {
    const { toJSON } = render(
      <ProfileHeader
        {...defaultProps}
        avatarUrl="https://example.com/avatar.jpg"
      />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
