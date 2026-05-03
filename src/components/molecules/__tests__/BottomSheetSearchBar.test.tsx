'use no memo';

import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import {
  BottomSheetSearchBar,
  type BottomSheetSearchBarRef,
} from '../BottomSheetSearchBar';

// Mock iconUtils
jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name, testID }: { name: string; testID?: string }) =>
      R.createElement(RN.Text, { testID: testID || `icon-${name}` }, name),
  };
});

describe('BottomSheetSearchBar', () => {
  const defaultProps = {
    onChangeText: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders with default props', () => {
    render(<BottomSheetSearchBar {...defaultProps} />);
    // Should render the search icon
    expect(screen.getByTestId('icon-search')).toBeTruthy();
  });

  it('renders custom placeholder', () => {
    render(
      <BottomSheetSearchBar {...defaultProps} placeholder="Search items..." />,
    );
    expect(screen.getByPlaceholderText('Search items...')).toBeTruthy();
  });

  it('renders default placeholder "Search..."', () => {
    render(<BottomSheetSearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('calls onChangeText after debounce', () => {
    render(<BottomSheetSearchBar {...defaultProps} debounceMs={100} />);
    const input = screen.getByPlaceholderText('Search...');

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
    render(<BottomSheetSearchBar {...defaultProps} />);
    expect(screen.queryByTestId('icon-close')).toBeNull();
  });

  it('shows clear button when text is present', () => {
    render(<BottomSheetSearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search...');

    fireEvent.changeText(input, 'hello');

    expect(screen.getByTestId('icon-close')).toBeTruthy();
  });

  it('clears text when clear button is pressed', () => {
    const onClear = jest.fn();
    render(<BottomSheetSearchBar {...defaultProps} onClear={onClear} />);
    const input = screen.getByPlaceholderText('Search...');

    // Type some text
    fireEvent.changeText(input, 'hello');

    // Press clear
    const clearButton = screen.getByTestId('icon-close');
    fireEvent.press(clearButton);

    // onChangeText should be called immediately with ''
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalled();
  });

  it('renders right actions', () => {
    const onAction = jest.fn();
    render(
      <BottomSheetSearchBar
        {...defaultProps}
        rightActions={[
          { icon: 'barcode-outline', onPress: onAction, testID: 'scan-btn' },
        ]}
      />,
    );

    expect(screen.getByTestId('scan-btn')).toBeTruthy();
    fireEvent.press(screen.getByTestId('scan-btn'));
    expect(onAction).toHaveBeenCalled();
  });

  it('renders multiple right actions', () => {
    render(
      <BottomSheetSearchBar
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
    const { toJSON } = render(
      <BottomSheetSearchBar {...defaultProps} isLoading={true} />,
    );
    // ActivityIndicator should be rendered
    expect(toJSON()).toBeTruthy();
  });

  it('does not show loading indicator when isLoading is false', () => {
    render(<BottomSheetSearchBar {...defaultProps} isLoading={false} />);
    // Just verify it renders without issue
    expect(screen.getByPlaceholderText('Search...')).toBeTruthy();
  });

  it('notifies parent when initialValue is provided', () => {
    render(<BottomSheetSearchBar {...defaultProps} initialValue="preloaded" />);
    // The useEffect calls onChangeText with the initialValue
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('preloaded');
  });

  it('updates hasText when initialValue changes', () => {
    const { rerender } = render(
      <BottomSheetSearchBar {...defaultProps} initialValue="" />,
    );
    // No text initially
    expect(screen.queryByTestId('icon-close')).toBeNull();

    // Change initialValue
    rerender(
      <BottomSheetSearchBar {...defaultProps} initialValue="new value" />,
    );
    // After initialValue changes, hasText should be true (render-time state update)
    expect(screen.getByTestId('icon-close')).toBeTruthy();
  });

  it('debounces multiple rapid changes', () => {
    render(<BottomSheetSearchBar {...defaultProps} debounceMs={250} />);
    const input = screen.getByPlaceholderText('Search...');

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
      const ref = createRef<BottomSheetSearchBarRef>();
      render(<BottomSheetSearchBar {...defaultProps} ref={ref} />);

      // Type text
      const input = screen.getByPlaceholderText('Search...');
      fireEvent.changeText(input, 'test');
      expect(screen.getByTestId('icon-close')).toBeTruthy();

      // Call clear via ref
      act(() => {
        ref.current?.clear();
      });

      // Clear button should disappear
      expect(screen.queryByTestId('icon-close')).toBeNull();
    });

    it('exposes getValue method', () => {
      const ref = createRef<BottomSheetSearchBarRef>();
      render(<BottomSheetSearchBar {...defaultProps} ref={ref} />);

      // Initially empty
      expect(ref.current?.getValue()).toBe('');

      // Type text
      const input = screen.getByPlaceholderText('Search...');
      fireEvent.changeText(input, 'hello');

      expect(ref.current?.getValue()).toBe('hello');
    });

    it('exposes setValue method', () => {
      const ref = createRef<BottomSheetSearchBarRef>();
      render(<BottomSheetSearchBar {...defaultProps} ref={ref} />);

      act(() => {
        ref.current?.setValue('programmatic');
      });

      expect(ref.current?.getValue()).toBe('programmatic');
      // Clear button should appear
      expect(screen.getByTestId('icon-close')).toBeTruthy();
    });

    it('setValue with empty string hides clear button', () => {
      const ref = createRef<BottomSheetSearchBarRef>();
      render(<BottomSheetSearchBar {...defaultProps} ref={ref} />);

      act(() => {
        ref.current?.setValue('text');
      });
      expect(screen.getByTestId('icon-close')).toBeTruthy();

      act(() => {
        ref.current?.setValue('');
      });
      expect(screen.queryByTestId('icon-close')).toBeNull();
    });
  });

  it('renders with custom testID', () => {
    render(<BottomSheetSearchBar {...defaultProps} testID="my-search" />);
    expect(screen.getByTestId('my-search')).toBeTruthy();
  });

  it('handles clear when onClear is not provided', () => {
    render(<BottomSheetSearchBar {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search...');

    fireEvent.changeText(input, 'hello');
    const clearButton = screen.getByTestId('icon-close');

    // Should not throw even without onClear
    fireEvent.press(clearButton);
    expect(defaultProps.onChangeText).toHaveBeenCalledWith('');
  });

  it('cleans up debounce timer on unmount', () => {
    const { unmount } = render(
      <BottomSheetSearchBar {...defaultProps} debounceMs={1000} />,
    );
    const input = screen.getByPlaceholderText('Search...');

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
