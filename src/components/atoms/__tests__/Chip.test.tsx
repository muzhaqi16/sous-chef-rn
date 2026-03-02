import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import Chip from '../Chip';

describe('Chip', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders label text', () => {
    render(<Chip label="Fruits" onPress={mockOnPress} />);
    expect(screen.getByText('Fruits')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    render(<Chip label="Dairy" onPress={mockOnPress} />);
    fireEvent.press(screen.getByText('Dairy'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('has accessibilityRole button', () => {
    render(<Chip label="Meat" onPress={mockOnPress} />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('renders with selected state', () => {
    render(<Chip label="Selected" selected onPress={mockOnPress} />);
    const chip = screen.getByRole('button');
    expect(chip.props.accessibilityState).toEqual({ selected: true });
  });

  it('renders with unselected state', () => {
    render(<Chip label="Unselected" selected={false} onPress={mockOnPress} />);
    const chip = screen.getByRole('button');
    expect(chip.props.accessibilityState).toEqual({ selected: false });
  });

  it('sets accessibilityLabel to the label', () => {
    render(<Chip label="Snacks" onPress={mockOnPress} />);
    expect(screen.getByLabelText('Snacks')).toBeTruthy();
  });
});
