'use no memo';
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, TextInput } = require('react-native');
  // What `useBottomSheetInternal` reads: set inside a sheet, null outside.
  const InternalContext = React.createContext(null);
  const inSheet = children =>
    React.createElement(InternalContext.Provider, { value: {} }, children);
  // Named, so a test can tell gorhom's input from React Native's.
  function BottomSheetTextInput(props) {
    return React.createElement(TextInput, props);
  }

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
      return inSheet(React.createElement(View, props));
    }),
    BottomSheetModal: React.forwardRef((props, ref) => {
      const [presented, setPresented] = React.useState(false);
      const dismissalVersion = React.useRef(0);
      const dismiss = () => {
        if (!presented) return;
        setPresented(false);
        const version = ++dismissalVersion.current;
        Promise.resolve().then(() => {
          if (version === dismissalVersion.current) props.onDismiss?.();
        });
      };
      React.useImperativeHandle(ref, () => ({
        present: () => {
          dismissalVersion.current += 1;
          setPresented(true);
        },
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
      return inSheet(
        React.createElement(
          View,
          rest,
          Handle ? React.createElement(Handle) : null,
          children,
          Footer
            ? React.createElement(Footer, {
                animatedFooterPosition: { value: 0 },
              })
            : null,
        ),
      );
    }),
    BottomSheetModalProvider: ({ children }) => children,
    BottomSheetBackdrop: props => React.createElement(View, props),
    BottomSheetView: props => React.createElement(View, props),
    BottomSheetScrollView: props => React.createElement(View, props),
    BottomSheetFlatList: props => React.createElement(View, props),
    BottomSheetTextInput,
    useBottomSheetInternal: unsafe => {
      const internal = React.useContext(InternalContext);
      if (!unsafe && internal === null) {
        throw "'useBottomSheetInternal' cannot be used out of the BottomSheet!";
      }
      return internal;
    },
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
