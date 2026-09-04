'use no memo';

// React Navigation officially recommends testing navigation-dependent components
// against a REAL navigator rather than fabricating `state` / `descriptors` /
// `navigation` props (https://reactnavigation.org/docs/testing/). Doing so here
// gives FloatingTabBar real, fully-typed props — no casts, no hand-rolled mocks.
//
// Two opt-outs from the global test setup are required:
//  1. `jest.unmock('@react-navigation/native')` — the global mock stubs
//     NavigationContainer to `({children}) => children`, which stops a real
//     navigator from registering.
//  2. Override the repo's `react-native-safe-area-context` mock with the
//     library's official one. The repo mock exposes a fake `SafeAreaInsetsContext`
//     (a plain object), but react-navigation v8's `SafeAreaProviderCompat` calls
//     `React.use(SafeAreaInsetsContext)`, and `use()` only accepts a real Context.
jest.unmock('@react-navigation/native');
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

import React from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { NavigationContainer } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { FloatingTabBar, TAB_BAR_HEIGHT } from '../FloatingTabBar';
import type { TabAppearance } from '../types';

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

// Mock animations constants
jest.mock('#/constants/animations', () => ({
  SHEET: { BACKDROP_OPACITY: 0.5 },
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

const DEFAULT_ROUTES = ['Pantry', 'ShoppingList', 'Recipe', 'MealPlan'];

// A fixture rather than the real `TAB_APPEARANCE`: importing `#features/registry`
// pulls in every tab's stack and therefore every screen in the app, which is
// both slow and circular here. That the real map matches the manifests is
// asserted in `src/navigation/stacks/__tests__/HomeTabs.test.tsx`, which
// already mounts the navigator; this suite is about the bar's behaviour given
// an appearance map, whatever it contains.
const TAB_APPEARANCE: TabAppearance = {
  Pantry: {
    icon: { active: 'home', inactive: 'home-outline' },
    mainScreen: 'PantryMain',
  },
  ShoppingList: {
    icon: { active: 'list', inactive: 'list-outline' },
    mainScreen: 'ShoppingListMain',
  },
  Recipe: {
    icon: { active: 'book', inactive: 'book-outline' },
    mainScreen: 'RecipeMain',
  },
  MealPlan: {
    icon: { active: 'calendar', inactive: 'calendar-outline' },
    mainScreen: 'MealPlanMain',
  },
};

const Tab = createBottomTabNavigator();

// Each screen renders identifiable text so navigation results are observable.
const makeScreen = (name: string) => () => <Text>{`${name} screen`}</Text>;

type ScreenListeners = React.ComponentProps<
  typeof Tab.Navigator
>['screenListeners'];

// The real `navigation` object passed to the tab bar — captured so tests that
// assert exact `navigate` call shapes can spy on it.
let tabBarNavigation: BottomTabBarProps['navigation'];

function renderTabBar(
  options: {
    routeNames?: string[];
    initialRouteName?: string;
    screenListeners?: ScreenListeners;
  } = {},
) {
  const routeNames = options.routeNames ?? DEFAULT_ROUTES;
  return render(
    <NavigationContainer>
      <Tab.Navigator
        initialRouteName={options.initialRouteName}
        screenOptions={{ headerShown: false }}
        screenListeners={options.screenListeners}
        tabBar={props => {
          tabBarNavigation = props.navigation;
          return <FloatingTabBar {...props} tabs={TAB_APPEARANCE} />;
        }}
      >
        {routeNames.map(name => (
          <Tab.Screen key={name} name={name} component={makeScreen(name)} />
        ))}
      </Tab.Navigator>
    </NavigationContainer>,
  );
}

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
    renderTabBar();
    expect(screen.getByTestId('tab-bar')).toBeTruthy();
  });

  it('renders all tab items', () => {
    renderTabBar();
    expect(screen.getByTestId('tab-Pantry')).toBeTruthy();
    expect(screen.getByTestId('tab-ShoppingList')).toBeTruthy();
    expect(screen.getByTestId('tab-Recipe')).toBeTruthy();
    expect(screen.getByTestId('tab-MealPlan')).toBeTruthy();
  });

  it('renders add button when showAddButton is true', () => {
    renderTabBar();
    expect(screen.getByTestId('add-button')).toBeTruthy();
  });

  it('renders placeholder when showAddButton is false', () => {
    mockTabBarState.showAddButton = false;
    renderTabBar();
    expect(screen.queryByTestId('add-button')).toBeNull();
  });

  it('calls onAddPress when add button is pressed', async () => {
    const user = userEvent.setup();
    renderTabBar();
    await user.press(screen.getByTestId('add-button'));
    expect(mockOnAddPress).toHaveBeenCalled();
  });

  it('shows toast when add button is disabled', async () => {
    const user = userEvent.setup();
    mockTabBarState.isAddButtonDisabled = true;
    mockTabBarState.addButtonDisabledMessage = 'No permission';
    const { toastService } = require('#/services/toastService');

    renderTabBar();
    await user.press(screen.getByTestId('add-button'));
    expect(toastService.info).toHaveBeenCalledWith('No permission');
    expect(mockOnAddPress).not.toHaveBeenCalled();
  });

  it('shows default message when add button is disabled without custom message', async () => {
    const user = userEvent.setup();
    mockTabBarState.isAddButtonDisabled = true;
    mockTabBarState.addButtonDisabledMessage = '';
    const { toastService } = require('#/services/toastService');

    renderTabBar();
    await user.press(screen.getByTestId('add-button'));
    expect(toastService.info).toHaveBeenCalledWith(
      "You don't have permission to perform this action",
    );
  });

  it('navigates to the tab on press', async () => {
    const user = userEvent.setup();
    renderTabBar();
    expect(screen.getByText('Pantry screen')).toBeTruthy();

    await user.press(screen.getByTestId('tab-ShoppingList'));

    // tabPress emits + (not prevented) navigates → the target screen mounts.
    expect(await screen.findByText('ShoppingList screen')).toBeTruthy();
  });

  it('navigates without stack reset when switching to unfocused tab', async () => {
    const user = userEvent.setup();
    renderTabBar();
    const navigateSpy = jest.spyOn(tabBarNavigation, 'navigate');

    await user.press(screen.getByTestId('tab-Recipe'));

    // Switching tabs navigates by name only — no nested-screen reset payload.
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('Recipe'));
  });

  it('resets stack to root when re-tapping focused tab', async () => {
    const user = userEvent.setup();
    renderTabBar({ initialRouteName: 'Recipe' });
    const navigateSpy = jest.spyOn(tabBarNavigation, 'navigate');

    await user.press(screen.getByTestId('tab-Recipe'));

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith('Recipe', {
        screen: 'RecipeMain',
        initial: false,
      }),
    );
  });

  it('does not navigate when the tabPress event is prevented', async () => {
    const user = userEvent.setup();
    renderTabBar({
      screenListeners: { tabPress: e => e.preventDefault() },
    });
    const navigateSpy = jest.spyOn(tabBarNavigation, 'navigate');

    await user.press(screen.getByTestId('tab-ShoppingList'));

    // Stays on the original screen; the prevented event blocks navigation.
    expect(screen.getByText('Pantry screen')).toBeTruthy();
    expect(screen.queryByText('ShoppingList screen')).toBeNull();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('sets active tab on mount', () => {
    renderTabBar();
    expect(mockSetActiveTab).toHaveBeenCalledWith('Pantry');
  });

  it('splits tabs around center add button', () => {
    renderTabBar();
    // All 4 tabs flank the center add button.
    expect(screen.getByTestId('tab-Pantry')).toBeTruthy();
    expect(screen.getByTestId('tab-ShoppingList')).toBeTruthy();
    expect(screen.getByTestId('tab-Recipe')).toBeTruthy();
    expect(screen.getByTestId('tab-MealPlan')).toBeTruthy();
    expect(screen.getByTestId('add-button')).toBeTruthy();
  });

  it('triggers HapticService.selection on tab press', async () => {
    const user = userEvent.setup();
    const { HapticService } = require('#services/haptic/HapticService');
    renderTabBar();

    await user.press(screen.getByTestId('tab-Recipe'));
    expect(HapticService.selection).toHaveBeenCalled();
  });

  it('navigates to a non-mainScreen tab (Profile) on press', async () => {
    const user = userEvent.setup();
    renderTabBar({
      routeNames: ['Pantry', 'ShoppingList', 'Recipe', 'Profile'],
    });

    await user.press(screen.getByTestId('tab-Profile'));

    expect(await screen.findByText('Profile screen')).toBeTruthy();
  });

  it('does not navigate to Profile when already focused', async () => {
    const user = userEvent.setup();
    renderTabBar({
      routeNames: ['Pantry', 'ShoppingList', 'Recipe', 'Profile'],
      initialRouteName: 'Profile',
    });
    const navigateSpy = jest.spyOn(tabBarNavigation, 'navigate');

    await user.press(screen.getByTestId('tab-Profile'));

    // Profile is focused and not in the mainScreen map → no navigation.
    await waitFor(() =>
      expect(mockSetActiveTab).toHaveBeenCalledWith('Profile'),
    );
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('exports TAB_BAR_HEIGHT', () => {
    expect(TAB_BAR_HEIGHT).toBe(65);
  });
});
