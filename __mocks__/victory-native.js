// Skia-drawn charts Jest cannot load (the package ships TypeScript source).
// Their marks are drawn, never in the accessibility tree, so they draw nothing
// here; a cartesian chart still hands its render function each series' points.
const React = require('react');
const { View } = require('react-native');

const BOUNDS = { top: 0, bottom: 200, left: 0, right: 390 };

const CartesianChart = ({ data = [], yKeys = [], children }) => {
  const points = Object.fromEntries(
    yKeys.map(key => [
      key,
      data.map((datum, index) => ({ x: index, y: datum[key] })),
    ]),
  );
  return React.createElement(
    View,
    null,
    typeof children === 'function'
      ? children({ points, chartBounds: BOUNDS })
      : children,
  );
};

const PolarChart = ({ children }) => React.createElement(View, null, children);

const drawn = () => null;

module.exports = {
  __esModule: true,
  CartesianChart,
  PolarChart,
  Line: drawn,
  Area: drawn,
  Bar: drawn,
  Pie: { Chart: drawn, Slice: drawn },
};
