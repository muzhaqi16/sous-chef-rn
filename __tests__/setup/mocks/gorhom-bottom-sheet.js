'use no memo';
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, TextInput } = require('react-native');

  return {
    __esModule: true,
    default: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        snapToIndex: jest.fn(),
        snapToPosition: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: jest.fn(),
        forceClose: jest.fn(),
      }));
      return React.createElement(View, props);
    }),
    BottomSheetModal: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
        snapToIndex: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: jest.fn(),
        forceClose: jest.fn(),
      }));
      // Render the handle/footer render-props so consumers that pin their
      // header/footer through them (e.g. ActionTray) still show that content
      // in tests. Remaining props (detached, onChange, onDismiss, …) stay on
      // the View so tests can read them.
      const {
        handleComponent: Handle,
        footerComponent: Footer,
        children,
        ...rest
      } = props;
      return React.createElement(
        View,
        rest,
        Handle ? React.createElement(Handle) : null,
        children,
        Footer
          ? React.createElement(Footer, {
              animatedFooterPosition: { value: 0 },
            })
          : null,
      );
    }),
    BottomSheetModalProvider: ({ children }) => children,
    BottomSheetBackdrop: props => React.createElement(View, props),
    BottomSheetView: props => React.createElement(View, props),
    BottomSheetScrollView: props => React.createElement(View, props),
    BottomSheetFlatList: props => React.createElement(View, props),
    BottomSheetTextInput: props => React.createElement(TextInput, props),
    BottomSheetFooter: props => React.createElement(View, props),
    BottomSheetHandle: props => React.createElement(View, props),
    useBottomSheet: jest.fn(() => ({
      snapToIndex: jest.fn(),
      expand: jest.fn(),
      collapse: jest.fn(),
      close: jest.fn(),
    })),
    useBottomSheetModal: jest.fn(() => ({
      dismiss: jest.fn(),
      dismissAll: jest.fn(),
    })),
    useBottomSheetDynamicSnapPoints: jest.fn(() => ({
      animatedHandleHeight: { value: 0 },
      animatedSnapPoints: { value: [0] },
      animatedContentHeight: { value: 0 },
      handleContentLayout: jest.fn(),
    })),
    useBottomSheetSpringConfigs: jest.fn(config => config),
    useBottomSheetScrollableCreator: jest.fn(() => {
      const ScrollableMock = props => React.createElement(View, props);
      return ScrollableMock;
    }),
  };
});
