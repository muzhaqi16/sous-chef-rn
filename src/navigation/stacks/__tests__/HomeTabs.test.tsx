'use no memo';
import type { ReactElement, ReactNode } from 'react';
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  gql,
  type ObservableQuery,
} from '@apollo/client';
import { ApolloProvider, useApolloClient } from '@apollo/client/react';
import { Text } from '#components/atoms/Text';
import { act, render, screen } from '@testing-library/react-native';
import {
  TabBarActionsProvider,
  useTabBarSetters,
} from '#/context/TabBarActionsContext';
import { RESYNC_SCOPE } from '#/apollo/scopedClient';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';

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
  screenLayout?: (props: {
    route: { name: string };
    children: ReactNode;
  }) => ReactElement;
  tabBar?: (props: Record<string, never>) => ReactElement<{ tabs: unknown }>;
}
let mockNavigatorConfig: NavigatorConfig | undefined;

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: (config: NavigatorConfig) => {
    mockNavigatorConfig = config;
    return { Navigator: 'Navigator', Screen: 'Screen', Group: 'Group' };
  },
  createBottomTabScreen: <T,>(config: T): T => config,
}));
jest.mock('../TodayStack', () => ({ TodayStack: 'TodayStack' }));
jest.mock('../PantryStack', () => ({ PantryStack: 'PantryStack' }));
jest.mock('../ShoppingListStack', () => ({
  ShoppingListStack: 'ShoppingListStack',
}));
jest.mock('../RecipeStack', () => ({ RecipeStack: 'RecipeStack' }));
jest.mock('../MealPlanStack', () => ({ MealPlanStack: 'MealPlanStack' }));
jest.mock('#app/FloatingTabBar/FloatingTabBar', () => ({
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

  // The tab bar gets its icons, labels and reset-to-root targets from here, so a
  // manifest that forgets one would silently render a `help-circle` tab.
  it('derives tab appearance from every tab feature', () => {
    expect(TAB_APPEARANCE).toEqual(
      Object.fromEntries(
        TAB_FEATURES.map(f => [
          f.tab.screenName,
          {
            icon: f.tab.icon,
            mainScreen: f.tab.mainScreen,
            titleKey: f.tab.titleKey,
          },
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
  // Mounted while hidden, a tab's queries stay active: its scope is what lets
  // a resync leave them until it is shown.
  it('scopes every query a tab watches to that tab', () => {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
      link: ApolloLink.empty(),
    });
    let watched: ObservableQuery | undefined;
    const Probe = () => {
      watched = useApolloClient().watchQuery({
        query: gql`
          query TabProbe {
            probe
          }
        `,
      });
      return null;
    };
    const layout = mockNavigatorConfig?.screenLayout;
    expect(layout).toBeDefined();

    render(
      <TabBarActionsProvider>
        <ApolloProvider client={client}>
          {layout?.({ route: { name: 'Pantry' }, children: <Probe /> })}
        </ApolloProvider>
      </TabBarActionsProvider>,
    );

    expect(watched?.options.context).toEqual({ [RESYNC_SCOPE]: 'Pantry' });
  });

  it('takes the tab out of either screen reader while the add menu covers it', () => {
    const layout = mockNavigatorConfig?.screenLayout;
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
      link: ApolloLink.empty(),
    });
    let openMenu: (open: boolean) => void = () => undefined;
    const Opener = () => {
      openMenu = useTabBarSetters().setAddMenuOpen;
      return null;
    };
    render(
      <TabBarActionsProvider>
        <Opener />
        <ApolloProvider client={client}>
          {layout?.({ route: { name: 'Pantry' }, children: <Text>Row</Text> })}
        </ApolloProvider>
      </TabBarActionsProvider>,
    );
    /** The tab's own wrapper: the nearest view above the row that hides it. */
    const wrapper = () => {
      let node = screen.getByText('Row', {
        includeHiddenElements: true,
      }).parent;
      while (node && node.props.importantForAccessibility === undefined) {
        node = node.parent;
      }
      if (!node) throw new Error('the tab has no wrapper');
      return node.props;
    };
    expect(screen.getByText('Row')).toBeTruthy();

    act(() => {
      openMenu(true);
    });

    expect(screen.queryByText('Row')).toBeNull();
    expect(wrapper()).toMatchObject({
      importantForAccessibility: 'no-hide-descendants',
      accessibilityElementsHidden: true,
    });
  });

  it('hands the tab bar its appearance', () => {
    expect(mockNavigatorConfig?.tabBar?.({}).props.tabs).toBe(TAB_APPEARANCE);
  });

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
