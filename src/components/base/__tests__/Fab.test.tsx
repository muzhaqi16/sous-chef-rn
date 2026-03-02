import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FAB } from '../Fab';

describe('FAB', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<FAB onPress={mockOnPress} />);
    expect(toJSON()).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    render(<FAB onPress={mockOnPress} accessibilityLabel="Add item" />);
    fireEvent.press(screen.getByRole('button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('has default accessibility label', () => {
    render(<FAB onPress={mockOnPress} />);
    expect(screen.getByLabelText('Add')).toBeTruthy();
  });

  it('uses custom accessibility label', () => {
    render(<FAB onPress={mockOnPress} accessibilityLabel="Create recipe" />);
    expect(screen.getByLabelText('Create recipe')).toBeTruthy();
  });

  it('has default accessibility hint', () => {
    render(<FAB onPress={mockOnPress} />);
    expect(screen.getByA11yHint('Tap to add a new item')).toBeTruthy();
  });

  it('renders with accessibilityRole button', () => {
    render(<FAB onPress={mockOnPress} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });
});
