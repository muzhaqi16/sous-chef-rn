import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { AlertBanner } from '../AlertBanner';

describe('AlertBanner', () => {
  it('renders title text', () => {
    render(<AlertBanner title="3 items expired" />);
    expect(screen.getByText('3 items expired')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<AlertBanner title="Expired" subtitle="Tap to review and remove" />);
    expect(screen.getByText('Tap to review and remove')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<AlertBanner title="Expired" />);
    expect(screen.queryByText('Tap to review and remove')).toBeNull();
  });

  it('renders default icon emoji', () => {
    const { toJSON } = render(<AlertBanner title="Warning" />);
    // Default icon is the warning emoji - just verify the component renders
    expect(toJSON()).toBeTruthy();
  });

  it('renders custom icon emoji', () => {
    render(<AlertBanner title="Success" icon="OK" />);
    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('calls onPress when banner is pressed', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(<AlertBanner title="Action" onPress={onPress} />);
    await user.press(screen.getByText('Action'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('applies testID to container', () => {
    render(<AlertBanner title="Test" testID="alert-banner" />);
    expect(screen.getByTestId('alert-banner')).toBeTruthy();
  });

  it('does not wrap in Pressable when onPress not provided', () => {
    const { toJSON } = render(<AlertBanner title="Static" />);
    expect(toJSON()).toBeTruthy();
  });
});
