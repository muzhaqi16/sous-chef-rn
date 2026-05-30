import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';

// Override the global unistyles mock to add useVariants (needed by ShoppingListItem's style variants)
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
          | ((theme: typeof lightTheme) => Record<string, unknown>),
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
          | ((theme: typeof lightTheme) => Record<string, unknown>),
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

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: {
    selection: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
  },
}));

jest.mock('#hooks/animations/useSlideAnimation', () => ({
  useSlideAnimation: jest.fn(() => ({
    animatedSlideStyle: {},
    triggerSlide: jest.fn((_dir: number, cb: () => void) => cb()),
  })),
}));

jest.mock('#hooks/performance/useRenderTime', () => ({
  useRenderTime: jest.fn(),
}));

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: 'CachedImage',
}));

jest.mock('#hooks/ui/useSwipeableCoordinator', () => ({
  useSwipeableCoordinator: jest.fn(() => ({
    activeId: null,
    register: jest.fn(),
    unregister: jest.fn(),
    requestOpen: jest.fn(),
    closeActive: jest.fn(),
  })),
}));

// Mock SwipeableItem to avoid its complex native gesture handler dependencies
jest.mock('../SwipeableItem/SwipeableItem', () => {
  const { View } = require('react-native');
  return {
    SwipeableItem: ({ children }: { children?: React.ReactNode }) =>
      require('react').createElement(
        View,
        { testID: 'swipeable-item' },
        children,
      ),
  };
});

import { ShoppingListItem } from '../ShoppingListItem';

describe('ShoppingListItem', () => {
  const defaultProps = {
    id: 'item-1',
    name: 'Milk',
    quantity: 2,
    isPurchased: false,
    onToggle: jest.fn(),
    onUpdateQuantity: jest.fn(),
    onDelete: jest.fn(),
    onEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders item name', () => {
    render(<ShoppingListItem {...defaultProps} />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders testID based on item id', () => {
    render(<ShoppingListItem {...defaultProps} />);
    expect(screen.getByTestId('shopping-item-item-1')).toBeTruthy();
  });

  it('renders checkbox with correct accessibility', () => {
    render(<ShoppingListItem {...defaultProps} />);
    const checkbox = screen.getByTestId('shopping-item-checkbox-item-1');
    expect(checkbox).toBeTruthy();
    expect(checkbox.props.accessibilityRole).toBe('checkbox');
    expect(checkbox.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );
  });

  it('calls onToggle when checkbox is pressed', async () => {
    const user = userEvent.setup();
    render(<ShoppingListItem {...defaultProps} />);
    await user.press(screen.getByTestId('shopping-item-checkbox-item-1'));
    expect(defaultProps.onToggle).toHaveBeenCalledWith('item-1');
  });

  it('marks checkbox as checked when isPurchased is true', () => {
    render(<ShoppingListItem {...defaultProps} isPurchased={true} />);
    const checkbox = screen.getByTestId('shopping-item-checkbox-item-1');
    expect(checkbox.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
  });

  it('renders quantity display with unit', () => {
    render(<ShoppingListItem {...defaultProps} unit="lbs" />);
    expect(screen.getByText(/2/)).toBeTruthy();
  });

  it('displays quantity input when provided', () => {
    render(
      <ShoppingListItem {...defaultProps} quantityInput="1/2" unit="cup" />,
    );
    expect(screen.getByText('1/2 cup')).toBeTruthy();
  });
});
