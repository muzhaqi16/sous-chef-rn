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
      const [presented, setPresented] = React.useState(false);
      const dismiss = () => {
        if (!presented) return;
        setPresented(false);
        props.onDismiss?.();
      };
      React.useImperativeHandle(ref, () => ({
        present: () => setPresented(true),
        dismiss,
        snapToIndex: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: dismiss,
        forceClose: dismiss,
      }));
      const {
        handleComponent: Handle,
        footerComponent: Footer,
        children,
        ...rest
      } = props;
      if (!presented) return null;
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
    // `BottomSheetKeyboardAwareScrollView` builds its base component at module
    // scope from these two, so a suite that merely imports something rendering
    // `BottomSheetFormScrollView` fails to load without them.
    SCROLLABLE_TYPE: {
      UNDETERMINED: 0,
      VIEW: 1,
      FLATLIST: 2,
      SCROLLVIEW: 3,
      SECTIONLIST: 4,
      VIRTUALIZEDLIST: 5,
    },
    createBottomSheetScrollableComponent: (_type, Scrollable) =>
      React.forwardRef((props, ref) =>
        React.createElement(Scrollable, { ...props, ref }),
      ),
    useBottomSheetScrollableCreator: jest.fn(() => {
      const ScrollableMock = props => React.createElement(View, props);
      return ScrollableMock;
    }),
  };
});
