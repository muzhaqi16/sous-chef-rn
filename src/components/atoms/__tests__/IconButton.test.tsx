import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { lightTheme } from '#theme/themes';
import { IconButton } from '../IconButton';

describe('IconButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <IconButton
        name="close"
        onPress={mockOnPress}
        accessibilityLabel="Close"
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    render(
      <IconButton
        name="close"
        onPress={mockOnPress}
        accessibilityLabel="Close"
        testID="icon-btn"
      />,
    );
    await user.press(screen.getByTestId('icon-btn'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const user = userEvent.setup();
    render(
      <IconButton
        name="close"
        onPress={mockOnPress}
        accessibilityLabel="Close"
        disabled
        testID="icon-btn"
      />,
    );
    await user.press(screen.getByTestId('icon-btn'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('has correct accessibility label', () => {
    render(
      <IconButton
        name="settings"
        onPress={mockOnPress}
        accessibilityLabel="Open settings"
      />,
    );
    expect(screen.getByLabelText('Open settings')).toBeTruthy();
  });

  it('has accessibilityRole button by default', () => {
    render(
      <IconButton
        name="edit"
        onPress={mockOnPress}
        accessibilityLabel="Edit"
      />,
    );
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('sets disabled accessibility state', () => {
    render(
      <IconButton
        name="delete"
        onPress={mockOnPress}
        accessibilityLabel="Delete"
        disabled
        testID="icon-btn"
      />,
    );
    const btn = screen.getByTestId('icon-btn');
    expect(btn.props.accessibilityState).toEqual({ disabled: true });
  });

  it('renders with testID', () => {
    render(
      <IconButton
        name="menu"
        onPress={mockOnPress}
        accessibilityLabel="Menu"
        testID="menu-btn"
      />,
    );
    expect(screen.getByTestId('menu-btn')).toBeTruthy();
  });

  // The fill is drawn at its own size; the target stays the platform floor.
  it('draws a fill at its size inside a floor-sized target', () => {
    render(
      <IconButton
        name="add"
        onPress={mockOnPress}
        accessibilityLabel="Add"
        filled={{ size: 'sm', tone: 'primaryLight' }}
        testID="add-btn"
      />,
    );

    expect(screen.getByTestId('add-btn')).toHaveStyle({
      minWidth: lightTheme.sizes.touchTarget.min,
      minHeight: lightTheme.sizes.touchTarget.min,
    });
    // The first host view inside the target.
    let [fill] = screen.getByTestId('add-btn').children;
    while (fill && typeof fill !== 'string' && typeof fill.type !== 'string') {
      [fill] = fill.children;
    }
    expect(fill).toHaveStyle({
      width: lightTheme.sizes.iconFill.sm,
      height: lightTheme.sizes.iconFill.sm,
    });
  });

  it('waits while loading, and says so', async () => {
    render(
      <IconButton
        name="send"
        onPress={mockOnPress}
        accessibilityLabel="Send"
        filled={{ size: 'xl', tone: 'primary' }}
        loading
      />,
    );

    const button = screen.getByRole('button', { name: 'Send' });
    expect(button.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
    await userEvent.setup().press(button);
    expect(mockOnPress).not.toHaveBeenCalled();
  });
});
