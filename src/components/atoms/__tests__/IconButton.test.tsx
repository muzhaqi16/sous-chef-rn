import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { IconButton } from '../IconButton';

describe('IconButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(
      <IconButton name="close" onPress={mockOnPress} accessibilityLabel="Close" />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    render(
      <IconButton name="close" onPress={mockOnPress} accessibilityLabel="Close" testID="icon-btn" />,
    );
    fireEvent.press(screen.getByTestId('icon-btn'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    render(
      <IconButton name="close" onPress={mockOnPress} accessibilityLabel="Close" disabled testID="icon-btn" />,
    );
    fireEvent.press(screen.getByTestId('icon-btn'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('has correct accessibility label', () => {
    render(
      <IconButton name="settings" onPress={mockOnPress} accessibilityLabel="Open settings" />,
    );
    expect(screen.getByLabelText('Open settings')).toBeTruthy();
  });

  it('has accessibilityRole button by default', () => {
    render(
      <IconButton name="edit" onPress={mockOnPress} accessibilityLabel="Edit" />,
    );
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('sets disabled accessibility state', () => {
    render(
      <IconButton name="delete" onPress={mockOnPress} accessibilityLabel="Delete" disabled testID="icon-btn" />,
    );
    const btn = screen.getByTestId('icon-btn');
    expect(btn.props.accessibilityState).toEqual({ disabled: true });
  });

  it('renders with testID', () => {
    render(
      <IconButton name="menu" onPress={mockOnPress} accessibilityLabel="Menu" testID="menu-btn" />,
    );
    expect(screen.getByTestId('menu-btn')).toBeTruthy();
  });
});
