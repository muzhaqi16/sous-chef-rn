// A pager-backed tab view Jest cannot load (it ships untransformed ESM): each
// tab of the bar jumps to its scene, and only the focused scene is mounted.
const React = require('react');
const { Pressable, Text, View } = require('react-native');

const LAYOUT = { width: 390, height: 844 };

const TabBar = ({ navigationState, jumpTo }) =>
  React.createElement(
    View,
    { accessibilityRole: 'tablist' },
    navigationState.routes.map((route, index) =>
      React.createElement(
        Pressable,
        {
          key: route.key,
          accessibilityRole: 'tab',
          accessibilityState: { selected: index === navigationState.index },
          onPress: () => jumpTo(route.key),
        },
        React.createElement(Text, null, route.title),
      ),
    ),
  );

const TabView = ({
  navigationState,
  renderScene,
  renderTabBar,
  onIndexChange,
}) => {
  const jumpTo = key =>
    onIndexChange(navigationState.routes.findIndex(route => route.key === key));
  const sceneProps = { jumpTo, layout: LAYOUT };
  const focused = navigationState.routes[navigationState.index];
  return React.createElement(
    View,
    null,
    renderTabBar
      ? renderTabBar({ navigationState, ...sceneProps })
      : React.createElement(TabBar, { navigationState, jumpTo }),
    focused
      ? React.createElement(
          View,
          { key: focused.key },
          renderScene({ route: focused, ...sceneProps }),
        )
      : null,
  );
};

const SceneMap =
  scenes =>
  ({ route }) =>
    React.createElement(scenes[route.key]);

module.exports = { __esModule: true, TabView, TabBar, SceneMap };
