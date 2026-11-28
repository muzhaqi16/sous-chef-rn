'use no memo';

import React, { createRef } from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  act,
} from '@testing-library/react-native';
import { SearchBar, type SearchBarRef } from '../SearchBar';

describe('SearchBar, debounced mode', () => {
  // Reports wait for the debounce; the field shows each keystroke.
  const defaultProps = {
    onChangeText: jest.fn(),
    debounceMs: 250,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders an empty field with no clear control', () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search…')).toBeTruthy();
    expect(screen.queryByLabelText('Clear input')).toBeNull();
  });

  it('renders custom placeholder', () => {
    render(<SearchBar {...defaultProps} placeholder="Search items..." />);
    expect(screen.getByPlaceholderText('Search items...')).toBeTruthy();
  });

  it('renders default placeholder "Search..."', () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search…')).toBeTruthy();
  });

  it('calls onChangeText after debounce', () => {
    render(<SearchBar {...defaultProps} debounceMs={100} />);
    const input = screen.getByPlaceholderText('Search…');

    fireEvent.changeText(input, 'test');

    // Not called yet (debounce pending)
    expect(defaultProps.onChangeText).not.toHaveBeenCalled();

    // Advance timers past debounce
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(defaultProps.onChangeText).toHaveBeenCalledWith('test');
  });

  it('does not show clear button when no text', () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.queryByLabelText('Clear input')).toBeNull();
  });

  it('shows clear button when text is present', () => {
    render(<SearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search…');

    fireEvent.changeText(input, 'hello');

    expect(screen.getByLabelText('Clear input')).toBeTruthy();
  });

  it('clears text when clear button is pressed', async () => {
    const user = userEvent.setup();
    const onClear = jest.fn();
    render(<SearchBar {...defaultProps} onClear={onClear} />);
    const input = screen.getByPlaceholderText('Search…');

    // Type some text
    fireEvent.changeText(input, 'hello');

    // Press clear
    const clearButton = screen.getByLabelText('Clear input');
    await user.press(clearButton);

    // onChangeText should be called immediately with ''
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalled();
  });

  it('renders its accessory and runs it', async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    render(
      <SearchBar
        {...defaultProps}
        accessory={{
          icon: 'options-outline',
          onPress: onAction,
          testID: 'filter-btn',
          accessibilityLabel: 'Filters',
        }}
      />,
    );

    await user.press(screen.getByTestId('filter-btn'));
    expect(onAction).toHaveBeenCalled();
  });

  it('shows loading indicator when isLoading is true', () => {
    const { toJSON } = render(<SearchBar {...defaultProps} isLoading={true} />);
    // ActivityIndicator should be rendered
    expect(toJSON()).toBeTruthy();
  });

  it('does not show loading indicator when isLoading is false', () => {
    render(<SearchBar {...defaultProps} isLoading={false} />);
    // Just verify it renders without issue
    expect(screen.getByPlaceholderText('Search…')).toBeTruthy();
  });

  it('shows the value it opens with, without reporting it back', () => {
    render(<SearchBar {...defaultProps} value="preloaded" />);

    expect(screen.getByDisplayValue('preloaded')).toBeOnTheScreen();
    expect(defaultProps.onChangeText).not.toHaveBeenCalled();
  });

  it('takes a value set from outside as a reset', () => {
    const { rerender } = render(<SearchBar {...defaultProps} value="" />);
    expect(screen.queryByLabelText('Clear input')).toBeNull();

    rerender(<SearchBar {...defaultProps} value="new value" />);

    expect(screen.getByDisplayValue('new value')).toBeOnTheScreen();
    expect(screen.getByLabelText('Clear input')).toBeOnTheScreen();
  });

  // The caller's echo of a report lands while more is being typed.
  it('keeps what is typed when the caller echoes an earlier report', () => {
    const { rerender } = render(<SearchBar {...defaultProps} value="" />);
    const input = screen.getByPlaceholderText('Search…');
    fireEvent.changeText(input, 'ab');
    act(() => {
      jest.advanceTimersByTime(250);
    });
    fireEvent.changeText(input, 'abc');

    rerender(<SearchBar {...defaultProps} value="ab" />);

    expect(screen.getByDisplayValue('abc')).toBeOnTheScreen();
  });

  it('debounces multiple rapid changes', () => {
    render(<SearchBar {...defaultProps} debounceMs={250} />);
    const input = screen.getByPlaceholderText('Search…');

    fireEvent.changeText(input, 'a');
    fireEvent.changeText(input, 'ab');
    fireEvent.changeText(input, 'abc');

    // Advance past debounce
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // Should only call with the last value
    expect(defaultProps.onChangeText).toHaveBeenCalledTimes(1);
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('abc');
  });

  describe('ref methods', () => {
    it('exposes clear method', () => {
      const ref = createRef<SearchBarRef>();
      render(<SearchBar {...defaultProps} ref={ref} />);

      // Type text
      const input = screen.getByPlaceholderText('Search…');
      fireEvent.changeText(input, 'test');
      expect(screen.getByLabelText('Clear input')).toBeTruthy();

      // Call clear via ref
      act(() => {
        ref.current?.clear();
      });

      // Clear button should disappear
      expect(screen.queryByLabelText('Clear input')).toBeNull();
    });

    it('exposes getValue method', () => {
      const ref = createRef<SearchBarRef>();
      render(<SearchBar {...defaultProps} ref={ref} />);

      // Initially empty
      expect(ref.current?.getValue()).toBe('');

      // Type text
      const input = screen.getByPlaceholderText('Search…');
      fireEvent.changeText(input, 'hello');

      expect(ref.current?.getValue()).toBe('hello');
    });
  });

  it('renders with custom testID', () => {
    render(<SearchBar {...defaultProps} testID="my-search" />);
    expect(screen.getByTestId('my-search')).toBeTruthy();
  });

  it('handles clear when onClear is not provided', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search…');

    fireEvent.changeText(input, 'hello');
    const clearButton = screen.getByLabelText('Clear input');

    // Should not throw even without onClear
    await user.press(clearButton);
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('');
  });

  it('cleans up debounce timer on unmount', () => {
    const { unmount } = render(
      <SearchBar {...defaultProps} debounceMs={1000} />,
    );
    const input = screen.getByPlaceholderText('Search…');

    fireEvent.changeText(input, 'test');

    // Unmount before debounce fires
    unmount();

    // Advance timers - should not cause issues
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // onChangeText should not have been called
    expect(defaultProps.onChangeText).not.toHaveBeenCalled();
  });
});
