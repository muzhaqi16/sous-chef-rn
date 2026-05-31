import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';

// Override the global unistyles mock to add useVariants (needed by BaseInput's style variants)
jest.mock('react-native-unistyles', () => {
  const { lightTheme } = require('../../../theme/themes');
  // NB: param types are inlined — a named `type` alias inside a jest.mock
  // factory trips babel-plugin-jest-hoist (it doesn't track type decls as
  // bindings, so it reports the reference as an out-of-scope variable).
  return {
    StyleSheet: {
      create: (
        styleFnOrObj:
          | Record<string, unknown>
          | ((theme: unknown) => Record<string, unknown>),
      ) => {
        const result =
          typeof styleFnOrObj === 'function'
            ? styleFnOrObj(lightTheme)
            : styleFnOrObj;
        result.useVariants = jest.fn();
        return result;
      },
      configure: jest.fn(),
    },
    useUnistyles: jest.fn(() => ({ theme: lightTheme, styles: {} })),
    useStyles: jest.fn(
      (
        stylesheet:
          | Record<string, unknown>
          | ((theme: unknown) => Record<string, unknown>),
      ) => ({
        styles:
          typeof stylesheet === 'function'
            ? stylesheet(lightTheme)
            : stylesheet || {},
        theme: lightTheme,
      }),
    ),
    useInitialTheme: jest.fn(),
    withUnistyles: jest.fn(<T,>(component: T) => component),
    UnistylesRuntime: {
      setTheme: jest.fn(),
      getTheme: jest.fn(() => lightTheme),
      colorScheme: 'light',
      themeName: 'light',
      contentSizeCategory: 'Medium',
      breakpoint: undefined,
      orientation: 'portrait',
      pixelRatio: 2,
      fontScale: 1,
      screen: { width: 390, height: 844 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
      statusBar: { width: 390, height: 44 },
      navigationBar: { width: 390, height: 0 },
    },
  };
});

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

  it('renders right action buttons', () => {
    const onFilter = jest.fn();
    render(
      <SearchBar
        {...defaultProps}
        rightActions={[
          {
            icon: 'filter',
            onPress: onFilter,
            accessibilityLabel: 'Filter',
            testID: 'filter-btn',
          },
        ]}
      />,
    );
    expect(screen.getByTestId('filter-btn')).toBeTruthy();
  });

  it('renders left action buttons', () => {
    const onMenu = jest.fn();
    render(
      <SearchBar
        {...defaultProps}
        leftActions={[
          {
            icon: 'menu',
            onPress: onMenu,
            accessibilityLabel: 'Menu',
            testID: 'menu-btn',
          },
        ]}
      />,
    );
    expect(screen.getByTestId('menu-btn')).toBeTruthy();
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
});
