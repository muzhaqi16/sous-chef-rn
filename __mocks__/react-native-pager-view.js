// A native pager Jest cannot load: its pages render in order inside a View,
// and `setPage` is a spy, so a test reaches every page and sees a page change.
const React = require('react');
const { View } = require('react-native');

const PagerView = React.forwardRef(({ children, style }, ref) => {
  React.useImperativeHandle(ref, () => ({
    setPage: jest.fn(),
    setPageWithoutAnimation: jest.fn(),
  }));
  return React.createElement(View, { style }, children);
});

module.exports = {
  __esModule: true,
  default: PagerView,
};
