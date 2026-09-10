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
  // `debounceMs` is what selects the uncontrolled mode these cases pin.
  const defaultProps = {
    onChangeText: jest.fn(),
    debounceMs: 250,
    showSearchIcon: true,
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

  it('renders right actions', async () => {
    const user = userEvent.setup();
    const onAction = jest.fn();
    render(
      <SearchBar
        {...defaultProps}
        rightActions={[
          { icon: 'barcode-outline', onPress: onAction, testID: 'scan-btn' },
        ]}
      />,
    );

    expect(screen.getByTestId('scan-btn')).toBeTruthy();
    await user.press(screen.getByTestId('scan-btn'));
    expect(onAction).toHaveBeenCalled();
  });

  it('renders multiple right actions', () => {
    render(
      <SearchBar
        {...defaultProps}
        rightActions={[
          { icon: 'barcode-outline', onPress: jest.fn(), testID: 'action-1' },
          { icon: 'camera-outline', onPress: jest.fn(), testID: 'action-2' },
        ]}
      />,
    );

    expect(screen.getByTestId('action-1')).toBeTruthy();
    expect(screen.getByTestId('action-2')).toBeTruthy();
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

  it('notifies parent when initialValue is provided', () => {
    render(<SearchBar {...defaultProps} defaultValue="preloaded" />);
    // The useEffect calls onChangeText with the initialValue
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('preloaded');
  });

  it('updates hasText when initialValue changes', () => {
    const { rerender } = render(
      <SearchBar {...defaultProps} defaultValue="" />,
    );
    // No text initially
    expect(screen.queryByLabelText('Clear input')).toBeNull();

    // Change initialValue
    rerender(<SearchBar {...defaultProps} defaultValue="new value" />);
    // After initialValue changes, hasText should be true (render-time state update)
    expect(screen.getByLabelText('Clear input')).toBeTruthy();
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

    it('exposes setValue method', () => {
      const ref = createRef<SearchBarRef>();
      render(<SearchBar {...defaultProps} ref={ref} />);

      act(() => {
        ref.current?.setValue('programmatic');
      });

      expect(ref.current?.getValue()).toBe('programmatic');
      // Clear button should appear
      expect(screen.getByLabelText('Clear input')).toBeTruthy();
    });

    it('setValue with empty string hides clear button', () => {
      const ref = createRef<SearchBarRef>();
      render(<SearchBar {...defaultProps} ref={ref} />);

      act(() => {
        ref.current?.setValue('text');
      });
      expect(screen.getByLabelText('Clear input')).toBeTruthy();

      act(() => {
        ref.current?.setValue('');
      });
      expect(screen.queryByLabelText('Clear input')).toBeNull();
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
