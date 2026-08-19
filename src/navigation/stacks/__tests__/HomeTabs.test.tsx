'use no memo';
import type { ReactNode } from 'react';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

// Capture the config `HomeTabs` hands to react-navigation. Without this the
// navigator factory swallows it, and the screen options below — the reason
// this module exists as a literal — are unobservable.
interface TabScreenConfig {
  screen: unknown;
  options?: Record<string, unknown>;
}
interface NavigatorConfig {
  screenOptions?: Record<string, unknown>;
  screens?: Record<string, TabScreenConfig>;
}
let mockNavigatorConfig: NavigatorConfig | undefined;

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: (config: NavigatorConfig) => {
    mockNavigatorConfig = config;
    return { Navigator: 'Navigator', Screen: 'Screen', Group: 'Group' };
  },
  createBottomTabScreen: <T,>(config: T): T => config,
}));
jest.mock('../PantryStack', () => ({ PantryStack: 'PantryStack' }));
jest.mock('../ShoppingListStack', () => ({
  ShoppingListStack: 'ShoppingListStack',
}));
jest.mock('../RecipeStack', () => ({ RecipeStack: 'RecipeStack' }));
jest.mock('../MealPlanStack', () => ({ MealPlanStack: 'MealPlanStack' }));
jest.mock('#/context/TabBarActionsContext', () => ({
  TabBarActionsProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('#components/navigation/FloatingTabBar/FloatingTabBar', () => ({
  FloatingTabBar: 'FloatingTabBar',
}));

import '../HomeTabs';

describe('HomeTabs', () => {
  const screenOptions = () => mockNavigatorConfig?.screenOptions ?? {};
  const screens = () => mockNavigatorConfig?.screens ?? {};

  it('registers the four tabs', () => {
    expect(Object.keys(screens())).toEqual([
      'Pantry',
      'ShoppingList',
      'Recipe',
      'MealPlan',
    ]);
  });

  // `'pause'` (React.Activity) tears down every layout effect in the blurred
  // subtree and re-runs them all in one synchronous commit on resume. Across
  // four FlashLists plus every mounted cell's own animation/gesture effects
  // that freezes the JS thread for seconds on a tab switch, so this navigator
  // deliberately opts out. See CLAUDE.md's `inactiveBehavior` section.
  it('keeps blurred tabs mounted rather than pausing them', () => {
    expect(screenOptions().inactiveBehavior).toBe('none');
  });

  it('does not let an individual tab opt back into pausing', () => {
    const overriding = Object.entries(screens()).filter(
      ([, config]) => config.options?.inactiveBehavior !== undefined,
    );

    expect(overriding).toEqual([]);
  });

  it('renders tabs lazily and crossfades between them', () => {
    expect(screenOptions()).toMatchObject({
      lazy: true,
      animation: 'fade',
      headerShown: false,
      tabBarHideOnKeyboard: true,
    });
  });
});
