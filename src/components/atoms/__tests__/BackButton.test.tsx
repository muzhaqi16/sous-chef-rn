import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BackButton } from '../BackButton';

describe('BackButton', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<BackButton onPress={mockOnPress} />);
    expect(toJSON()).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    render(<BackButton onPress={mockOnPress} testID="back-btn" />);
    fireEvent.press(screen.getByTestId('back-btn'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('has accessibility label "Go back"', () => {
    render(<BackButton onPress={mockOnPress} />);
    expect(screen.getByLabelText('Go back')).toBeTruthy();
  });

  it('does not call onPress when disabled', () => {
    render(<BackButton onPress={mockOnPress} disabled testID="back-btn" />);
    fireEvent.press(screen.getByTestId('back-btn'));
    expect(mockOnPress).not.toHaveBeenCalled();
  });

  it('renders with testID', () => {
    render(<BackButton onPress={mockOnPress} testID="custom-back" />);
    expect(screen.getByTestId('custom-back')).toBeTruthy();
  });
});
