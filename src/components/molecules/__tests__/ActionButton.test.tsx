import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ActionButton } from '../ActionButton';

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: {
    selection: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
  },
}));

describe('ActionButton', () => {
  const defaultProps = {
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default icon name', () => {
    render(<ActionButton {...defaultProps} />);
    // Default accessibility label uses the icon name "add"
    expect(screen.getByLabelText('Add button')).toBeTruthy();
  });

  it('renders with custom icon name', () => {
    render(<ActionButton {...defaultProps} name="filter" />);
    expect(screen.getByLabelText('filter button')).toBeTruthy();
  });

  it('renders with custom accessibility label', () => {
    render(
      <ActionButton
        {...defaultProps}
        accessibilityLabel="Create new item"
      />,
    );
    expect(screen.getByLabelText('Create new item')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    render(<ActionButton {...defaultProps} accessibilityLabel="Add" />);
    fireEvent.press(screen.getByLabelText('Add'));
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('applies testID', () => {
    render(<ActionButton {...defaultProps} testID="action-btn" />);
    expect(screen.getByTestId('action-btn')).toBeTruthy();
  });
});
