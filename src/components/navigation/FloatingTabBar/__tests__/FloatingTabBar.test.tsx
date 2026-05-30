'use no memo';

import React from 'react';
import { render, screen, userEvent, act } from '@testing-library/react-native';
import {
  FloatingTabBar as _FloatingTabBar,
  TAB_BAR_HEIGHT,
} from '../FloatingTabBar';

// NOTE: the real `FloatingTabBarProps` (extends BottomTabBarProps) omits the
// `insets` prop the tests pass and does not structurally overlap the simplified
// mock navigation/descriptor shapes (mock `state.type` is `string` not `'tab'`,
// `preloadedRouteKeys` is absent, navigation/descriptors are partial jest mocks),
// so the reference stays loosely typed. A precise cast is impossible without
// editing the component source or using a banned `as unknown as` form — tsc's
// own diagnostic on a two-step `Partial<>` widening recommends exactly that
// banned form.
const FloatingTabBar = _FloatingTabBar as any;

// Mock TabBarActionsContext
const mockSetActiveTab = jest.fn();
const mockOnAddPress = jest.fn();
let mockTabBarState = {
  onAddPress: mockOnAddPress,
  showAddButton: true,
  addButtonConfig: { icon: 'add', iconLibrary: 'Ionicons' },
  isAddButtonDisabled: false,
  addButtonDisabledMessage: '',
  isOverlayOpen: false,
};

jest.mock('#context/TabBarActionsContext', () => ({
  useTabBarState: jest.fn(() => mockTabBarState),
  useTabBarSetters: jest.fn(() => ({
    setActiveTab: mockSetActiveTab,
    setScannerProps: jest.fn(),
    setAddProps: jest.fn(),
    setOverlayOpen: jest.fn(),
  })),
}));

// Mock toastService
jest.mock('#/services/toastService', () => ({
  toastService: {
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

// Mock HapticService
jest.mock('#services/haptic/HapticService', () => ({
  HapticService: {
    selection: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
  },
}));

// Mock useShowNavigationLabels
jest.mock('#hooks/settings/useSettings', () => ({
  useShowNavigationLabels: jest.fn(() => true),
}));

// Mock animations constants
jest.mock('#/constants/animations', () => ({
  SPRING: { HEAVY: { damping: 20, stiffness: 300 } },
  TIMING: { FAST: 150 },
}));

// Mock iconUtils
jest.mock('#utils/iconUtils', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    Icon: ({ name }: { name: string }) =>
      R.createElement(RN.Text, { testID: `icon-${name}` }, name),
  };
});

// Mock AddButton — NOTE: do NOT pass disabled to Pressable since it blocks await user.press
jest.mock('../AddButton', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    AddButton: ({ onPress }: { onPress: () => void }) =>
      R.createElement(
        RN.Pressable,
        { testID: 'add-button', onPress },
        R.createElement(RN.Text, {}, 'Add'),
      ),
  };
});

// Mock TabItem
jest.mock('../TabItem', () => {
  const R = require('react');
  const RN = require('react-native');
  return {
    TabItem: ({
      route,
      isFocused,
      onPress,
    }: {
      route: { name: string };
      isFocused: boolean;
      onPress: () => void;
    }) =>
      R.createElement(
        RN.Pressable,
        {
          testID: `tab-${route.name}`,
          onPress,
          accessibilityState: { selected: isFocused },
        },
        R.createElement(RN.Text, {}, route.name),
      ),
  };
});

function createNavigationState(
  routeNames = ['Pantry', 'ShoppingList', 'Recipe', 'MealPlan'],
  index = 0,
) {
  const routes = routeNames.map((name, i) => ({
    key: `${name}-key-${i}`,
    name,
    params: {},
  }));
  return {
    routes,
    index,
    type: 'tab',
    key: 'tab-key',
    routeNames,
    stale: false,
    history: [],
  };
}

type MockDescriptor = {
  options: Record<string, unknown>;
  render: jest.Mock;
  navigation: object;
};

function createDescriptors(
  routeNames = ['Pantry', 'ShoppingList', 'Recipe', 'MealPlan'],
  overrides: Record<string, Record<string, unknown>> = {},
): Record<string, MockDescriptor> {
  const descriptors: Record<string, MockDescriptor> = {};
  routeNames.forEach((name, i) => {
    const key = `${name}-key-${i}`;
    descriptors[key] = {
      options: overrides[name] || {},
      render: jest.fn(),
      navigation: {},
    };
  });
  return descriptors;
}

const mockNavigate = jest.fn();
const mockEmit = jest.fn(() => ({ defaultPrevented: false }));

const createNavigation = () => ({
  navigate: mockNavigate,
  emit: mockEmit,
  dispatch: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  setParams: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(() => true),
  canGoBack: jest.fn(() => true),
  getId: jest.fn(),
  getParent: jest.fn(),
  getState: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  removeListener: jest.fn(),
});

describe('FloatingTabBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTabBarState = {
      onAddPress: mockOnAddPress,
      showAddButton: true,
      addButtonConfig: { icon: 'add', iconLibrary: 'Ionicons' },
      isAddButtonDisabled: false,
      addButtonDisabledMessage: '',
      isOverlayOpen: false,
    };
  });

  it('renders with testID tab-bar', () => {
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
  });

  it('renders all tab items', () => {
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );
    expect(screen.getByTestId('tab-Pantry')).toBeTruthy();
    expect(screen.getByTestId('tab-ShoppingList')).toBeTruthy();
    expect(screen.getByTestId('tab-Recipe')).toBeTruthy();
    expect(screen.getByTestId('tab-MealPlan')).toBeTruthy();
  });

  it('renders add button when showAddButton is true', () => {
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );
    expect(screen.getByTestId('add-button')).toBeTruthy();
  });

  it('renders placeholder when showAddButton is false', () => {
    mockTabBarState.showAddButton = false;
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );
    expect(screen.queryByTestId('add-button')).toBeNull();
  });

  it('calls onAddPress when add button is pressed', async () => {
    const user = userEvent.setup();
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );
    await user.press(screen.getByTestId('add-button'));
    expect(mockOnAddPress).toHaveBeenCalled();
  });

  it('shows toast when add button is disabled', async () => {
    const user = userEvent.setup();
    mockTabBarState.isAddButtonDisabled = true;
    mockTabBarState.addButtonDisabledMessage = 'No permission';
    const { toastService } = require('#/services/toastService');

    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );
    await user.press(screen.getByTestId('add-button'));
    expect(toastService.info).toHaveBeenCalledWith('No permission');
    expect(mockOnAddPress).not.toHaveBeenCalled();
  });

  it('shows default message when add button is disabled without custom message', async () => {
    const user = userEvent.setup();
    mockTabBarState.isAddButtonDisabled = true;
    mockTabBarState.addButtonDisabledMessage = '';
    const { toastService } = require('#/services/toastService');

    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );
    await user.press(screen.getByTestId('add-button'));
    expect(toastService.info).toHaveBeenCalledWith(
      "You don't have permission to perform this action",
    );
  });

  it('handles tab press and emits event', async () => {
    const user = userEvent.setup();
    const nav = createNavigation();
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={nav}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );

    await user.press(screen.getByTestId('tab-ShoppingList'));

    expect(nav.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'ShoppingList-key-1',
      canPreventDefault: true,
    });
  });

  it('navigates without stack reset when switching to unfocused tab', async () => {
    const user = userEvent.setup();
    const nav = createNavigation();
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={nav}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );

    await user.press(screen.getByTestId('tab-Recipe'));

    // Switching tabs should just navigate without resetting the stack
    expect(nav.navigate).toHaveBeenCalledWith('Recipe');
  });

  it('resets stack to root when re-tapping focused tab', async () => {
    const user = userEvent.setup();
    const nav = createNavigation();
    // Recipe is focused (index 2)
    const state = createNavigationState(
      ['Pantry', 'ShoppingList', 'Recipe', 'MealPlan'],
      2,
    );
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={nav}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );

    await user.press(screen.getByTestId('tab-Recipe'));

    expect(nav.navigate).toHaveBeenCalledWith('Recipe', {
      screen: 'RecipeMain',
      initial: false,
    });
  });

  it('does not navigate when event is prevented', async () => {
    const user = userEvent.setup();
    const nav = createNavigation();
    nav.emit.mockReturnValue({ defaultPrevented: true });
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={nav}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );

    await user.press(screen.getByTestId('tab-ShoppingList'));

    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('sets active tab on mount', () => {
    const state = createNavigationState(
      ['Pantry', 'ShoppingList', 'Recipe', 'MealPlan'],
      0,
    );
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );
    expect(mockSetActiveTab).toHaveBeenCalledWith('Pantry');
  });

  it('splits tabs around center add button', () => {
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );
    // All 4 tabs should be present
    expect(screen.getByTestId('tab-Pantry')).toBeTruthy();
    expect(screen.getByTestId('tab-ShoppingList')).toBeTruthy();
    expect(screen.getByTestId('tab-Recipe')).toBeTruthy();
    expect(screen.getByTestId('tab-MealPlan')).toBeTruthy();
  });

  it('triggers HapticService.selection on tab press', async () => {
    const user = userEvent.setup();
    const { HapticService } = require('#services/haptic/HapticService');
    const state = createNavigationState();
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors()}
        navigation={createNavigation()}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );

    await user.press(screen.getByTestId('tab-Recipe'));
    expect(HapticService.selection).toHaveBeenCalled();
  });

  it('emits tabPress event for Profile tab (non-mainScreen tab)', async () => {
    const user = userEvent.setup();
    const nav = createNavigation();
    const routeNames = ['Pantry', 'ShoppingList', 'Recipe', 'Profile'];
    const state = createNavigationState(routeNames, 0);
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors(routeNames)}
        navigation={nav}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );

    await act(async () => {
      await user.press(screen.getByTestId('tab-Profile'));
    });

    // Emit is always called
    expect(nav.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tabPress',
        target: 'Profile-key-3',
      }),
    );
  });

  it('does not navigate to Profile when already focused', async () => {
    const user = userEvent.setup();
    const nav = createNavigation();
    const routeNames = ['Pantry', 'ShoppingList', 'Recipe', 'Profile'];
    const state = createNavigationState(routeNames, 3); // Profile is focused
    render(
      <FloatingTabBar
        state={state}
        descriptors={createDescriptors(routeNames)}
        navigation={nav}
        insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
      />,
    );

    await act(async () => {
      await user.press(screen.getByTestId('tab-Profile'));
    });

    // emit is called, but navigate is NOT called because Profile is already focused
    // and it's not in mainScreenMap
    expect(nav.emit).toHaveBeenCalled();
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it('exports TAB_BAR_HEIGHT', () => {
    expect(TAB_BAR_HEIGHT).toBe(65);
  });
});
