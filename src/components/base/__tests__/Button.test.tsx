import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders with title prop', () => {
    render(<Button onPress={mockOnPress} title="Save" />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders with children', () => {
    render(<Button onPress={mockOnPress}>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    render(
      <Button onPress={mockOnPress} testID="btn">
        Press
      </Button>,
    );
    fireEvent.press(screen.getByTestId('btn'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    render(
      <Button onPress={mockOnPress} disabled testID="btn">
        Press
      </Button>,
    );
    fireEvent.press(screen.getByTestId('btn'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    render(
      <Button onPress={mockOnPress} loading testID="btn">
        Press
      </Button>,
    );
    fireEvent.press(screen.getByTestId('btn'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('sets accessibilityRole to button', () => {
    render(<Button onPress={mockOnPress}>OK</Button>);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('sets accessibility state for disabled', () => {
    render(
      <Button onPress={mockOnPress} disabled testID="btn">
        OK
      </Button>,
    );
    const btn = screen.getByTestId('btn');
    expect(btn.props.accessibilityState).toEqual({
      disabled: true,
      busy: false,
    });
  });

  it('sets accessibility state for loading', () => {
    render(
      <Button onPress={mockOnPress} loading testID="btn">
        OK
      </Button>,
    );
    const btn = screen.getByTestId('btn');
    expect(btn.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });
});
