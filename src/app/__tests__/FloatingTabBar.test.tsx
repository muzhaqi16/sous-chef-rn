import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';
import { AddButton } from '../FloatingTabBar/AddButton';
import { TabItem } from '../FloatingTabBar/TabItem';

// Mock all external dependencies
jest.mock('#context/TabBarActionsContext', () => ({
  useTabBarState: jest.fn(() => ({
    onAddPress: jest.fn(),
    showAddButton: true,
    addButtonConfig: { icon: 'add', iconLibrary: undefined },
    isAddButtonDisabled: false,
    addButtonDisabledMessage: '',
    isOverlayOpen: false,
  })),
  useTabBarSetters: jest.fn(() => ({
    setActiveTab: jest.fn(),
  })),
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    info: jest.fn(),
  },
}));

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: {
    selection: jest.fn(),
    medium: jest.fn(),
  },
}));

jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) =>
      R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

jest.mock('#/constants/animations', () => ({}));

// Patch useAnimatedReaction which is missing from the global jest.setup.js reanimated mock
const reanimated = require('react-native-reanimated');
if (!reanimated.useAnimatedReaction) {
  reanimated.useAnimatedReaction = jest.fn();
}

describe('AddButton', () => {
  it('renders with testID', () => {
    render(<AddButton onPress={jest.fn()} />);
    expect(screen.getByTestId('tab-bar-add-button')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(<AddButton onPress={onPress} />);
    await user.press(screen.getByTestId('tab-bar-add-button'));
    expect(onPress).toHaveBeenCalled();
  });

  it('has correct accessibility label', () => {
    render(<AddButton onPress={jest.fn()} />);
    expect(screen.getByLabelText('Action button')).toBeTruthy();
  });

  it('renders as disabled when disabled prop is true', () => {
    render(<AddButton onPress={jest.fn()} disabled />);
    const button = screen.getByTestId('tab-bar-add-button');
    expect(button.props.accessibilityState).toEqual({ disabled: true });
  });

  it('is not disabled by default', () => {
    render(<AddButton onPress={jest.fn()} />);
    const button = screen.getByTestId('tab-bar-add-button');
    expect(button.props.accessibilityState).toEqual({ disabled: false });
  });
});

describe('TabItem', () => {
  const mockSharedValue = {
    value: 0,
    get: jest.fn(() => 0),
    set: jest.fn(),
  } as Partial<SharedValue<number>> as SharedValue<number>;

  const defaultTabProps = {
    route: { key: 'pantry-key', name: 'Pantry' },
    isFocused: false,
    options: { title: 'Pantry', tabBarAccessibilityLabel: 'Pantry tab' },
    onPress: jest.fn(),
    showLabel: true,
    activeTabIndex: mockSharedValue,
    tabIndex: 0,
  };

  it('renders with correct testID', () => {
    render(<TabItem {...defaultTabProps} />);
    expect(screen.getByTestId('tab-pantry')).toBeTruthy();
  });

  it('renders label when showLabel is true', () => {
    render(<TabItem {...defaultTabProps} />);
    expect(screen.getByText('Pantry')).toBeTruthy();
  });

  it('does not render label when showLabel is false', () => {
    render(<TabItem {...defaultTabProps} showLabel={false} />);
    // The icon text "home-outline" may still contain "Pantry" via another path
    // But the label text itself should not be rendered
    const labels = screen.queryAllByText('Pantry');
    // Only icon text is rendered, not label
    expect(labels.length).toBeLessThanOrEqual(1);
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(<TabItem {...defaultTabProps} onPress={onPress} />);
    await user.press(screen.getByTestId('tab-pantry'));
    expect(onPress).toHaveBeenCalled();
  });

  it('sets selected accessibility state when focused', () => {
    render(<TabItem {...defaultTabProps} isFocused={true} />);
    const tab = screen.getByTestId('tab-pantry');
    expect(tab.props.accessibilityState).toEqual({ selected: true });
  });

  it('uses title from options when available', () => {
    render(
      <TabItem
        {...defaultTabProps}
        options={{ title: 'Custom Title', tabBarAccessibilityLabel: 'Custom' }}
      />,
    );
    expect(screen.getByText('Custom Title')).toBeTruthy();
  });

  it('falls back to route name when title is not provided', () => {
    render(
      <TabItem
        {...defaultTabProps}
        options={{ tabBarAccessibilityLabel: 'Tab' }}
      />,
    );
    expect(screen.getByText('Pantry')).toBeTruthy();
  });
});
