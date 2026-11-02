import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';

import { SearchBar } from '../SearchBar';

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: {
    selection: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
  },
}));

describe('SearchBar', () => {
  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with default placeholder', () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search\u2026')).toBeTruthy();
  });

  it('renders with custom placeholder', () => {
    render(<SearchBar {...defaultProps} placeholder="Find items..." />);
    expect(screen.getByPlaceholderText('Find items...')).toBeTruthy();
  });

  it('displays the current value', () => {
    render(<SearchBar {...defaultProps} value="milk" />);
    expect(screen.getByDisplayValue('milk')).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    render(<SearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search\u2026');
    fireEvent.changeText(input, 'eggs');
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('eggs');
  });

  it('renders its one accessory beside the field', () => {
    const onFilter = jest.fn();
    render(
      <SearchBar
        {...defaultProps}
        accessory={{
          icon: 'filter',
          onPress: onFilter,
          accessibilityLabel: 'Filter',
          testID: 'filter-btn',
        }}
      />,
    );
    expect(screen.getByTestId('filter-btn')).toBeTruthy();
  });

  it('renders nothing beside the field without an accessory', () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.queryByTestId('filter-btn')).toBeNull();
  });

  it('shows clear button when value is non-empty', () => {
    render(<SearchBar {...defaultProps} value="text" />);
    // BaseInput renders a clear button with "Clear input" label
    expect(screen.getByLabelText('Clear input')).toBeTruthy();
  });

  it('clears value when clear button is pressed', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} value="text" />);
    await user.press(screen.getByLabelText('Clear input'));
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('');
  });

  it('searches as typed, with no autocorrect unless a caller asks for it', () => {
    const { rerender } = render(<SearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search\u2026').props).toMatchObject({
      autoCorrect: false,
    });

    rerender(<SearchBar {...defaultProps} autoCorrect />);
    expect(screen.getByPlaceholderText('Search\u2026').props).toMatchObject({
      autoCorrect: true,
    });
  });
});
