const React = require('react');
const { View } = require('react-native');

// The native image view stands in as a plain View. Its cache methods answer as
// the native module does when it has nothing to load.
const TurboImage = props => React.createElement(View, props);
TurboImage.prefetch = jest.fn(async () => true);
TurboImage.clearMemoryCache = jest.fn(async () => true);
TurboImage.clearDiskCache = jest.fn(async () => true);

module.exports = {
  __esModule: true,
  default: TurboImage,
};
