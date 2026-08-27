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
import { TAB_APPEARANCE, TAB_FEATURES } from '#features/registry';

describe('HomeTabs', () => {
  const screenOptions = () => mockNavigatorConfig?.screenOptions ?? {};
  const screens = () => mockNavigatorConfig?.screens ?? {};

  // The `screens` literal is the one thing the registry cannot build, because
  // react-navigation infers per-tab param types only from a literal shape. So
  // the literal and the registry are asserted to agree here — including ORDER,
  // which is what `tab.order` decides — rather than hoping nobody adds a tab to
  // one and not the other.
  it('registers exactly the enabled tab features, in manifest order', () => {
    expect(Object.keys(screens())).toEqual(
      TAB_FEATURES.map(f => f.tab.screenName),
    );
  });

  it('labels each tab with its manifest i18n key', () => {
    const titles = Object.fromEntries(
      Object.entries(screens()).map(([name, config]) => [
        name,
        config.options?.title,
      ]),
    );
    expect(titles).toEqual(
      Object.fromEntries(
        TAB_FEATURES.map(f => [f.tab.screenName, f.tab.titleKey]),
      ),
    );
  });

  // The tab bar gets its icons and reset-to-root targets from here, so a
  // manifest that forgets one would silently render a `help-circle` tab.
  it('derives tab appearance from every tab feature', () => {
    expect(TAB_APPEARANCE).toEqual(
      Object.fromEntries(
        TAB_FEATURES.map(f => [
          f.tab.screenName,
          { icon: f.tab.icon, mainScreen: f.tab.mainScreen },
        ]),
      ),
    );
    for (const { tab } of TAB_FEATURES) {
      expect(tab.mainScreen).toMatch(/Main$/);
      expect(tab.icon.inactive).toBe(`${tab.icon.active}-outline`);
    }
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
