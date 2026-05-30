'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import type { NavigationState } from 'react-native-tab-view';
import { TabView } from '../TabView';
import type { TabRoute } from '../TabView';

jest.mock('react-native-tab-view', () => {
  const RN = require('react-native');
  const R = require('react');

  const MockTabView = ({
    renderScene,
    navigationState,
    renderTabBar,
  }: {
    renderScene: (props: unknown) => React.ReactNode;
    navigationState: NavigationState<TabRoute>;
    renderTabBar: (props: unknown) => React.ReactNode;
  }) => {
    const tabBarProps = {
      navigationState,
      jumpTo: jest.fn(),
      layout: { width: 390, height: 844 },
      position: { interpolate: jest.fn() },
    };
    return R.createElement(
      RN.View,
      { testID: 'tab-view' },
      renderTabBar(tabBarProps),
      navigationState.routes.map((route, index: number) => {
        if (index === navigationState.index) {
          return R.createElement(
            RN.View,
            { key: route.key, testID: `scene-${route.key}` },
            renderScene({
              route,
              jumpTo: jest.fn(),
              layout: { width: 390, height: 844 },
              position: { interpolate: jest.fn() },
            }),
          );
        }
        return null;
      }),
    );
  };

  const MockTabBar = ({
    navigationState,
  }: {
    navigationState: NavigationState<TabRoute>;
  }) =>
    R.createElement(
      RN.View,
      { testID: 'tab-bar' },
      navigationState.routes.map(route =>
        R.createElement(RN.Text, { key: route.key }, route.title),
      ),
    );

  return {
    TabView: MockTabView,
    TabBar: MockTabBar,
  };
});

describe('TabView', () => {
  const routes: TabRoute[] = [
    { key: 'tab1', title: 'First' },
    { key: 'tab2', title: 'Second' },
    { key: 'tab3', title: 'Third' },
  ];

  const renderScene = ({ route }: { route: TabRoute }) => (
    <View testID={`content-${route.key}`}>
      <Text>{`Content for ${route.title}`}</Text>
    </View>
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the tab view container', () => {
    render(<TabView routes={routes} renderScene={renderScene} />);
    expect(screen.getByTestId('tab-view')).toBeTruthy();
  });

  it('renders tab bar with route titles', () => {
    render(<TabView routes={routes} renderScene={renderScene} />);
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.getByText('Third')).toBeTruthy();
  });

  it('renders the first tab scene by default', () => {
    render(<TabView routes={routes} renderScene={renderScene} />);
    expect(screen.getByText('Content for First')).toBeTruthy();
  });

  it('renders initial tab based on initialTabIndex', () => {
    render(
      <TabView routes={routes} renderScene={renderScene} initialTabIndex={1} />,
    );
    expect(screen.getByText('Content for Second')).toBeTruthy();
  });

  it('renders route titles with badge counts', () => {
    const routesWithBadges: TabRoute[] = [
      { key: 'tab1', title: 'Items', badge: 5 },
      { key: 'tab2', title: 'Lists', badge: 0 },
      { key: 'tab3', title: 'Settings' },
    ];
    render(<TabView routes={routesWithBadges} renderScene={renderScene} />);
    expect(screen.getByText('Items (5)')).toBeTruthy();
    expect(screen.getByText('Lists')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders with custom lazy placeholder', () => {
    const customPlaceholder = ({ route }: { route: TabRoute }) => (
      <Text>Loading {route.title}...</Text>
    );
    const { toJSON } = render(
      <TabView
        routes={routes}
        renderScene={renderScene}
        renderLazyPlaceholder={customPlaceholder}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders without errors when swipeEnabled is false', () => {
    const { toJSON } = render(
      <TabView
        routes={routes}
        renderScene={renderScene}
        swipeEnabled={false}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
