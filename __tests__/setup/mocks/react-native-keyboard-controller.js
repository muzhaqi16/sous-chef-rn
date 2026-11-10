'use no memo';
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }) => children,
  useKeyboardHandler: jest.fn(),
  // The variant that leaves the Android soft-input mode alone. Like its sibling
  // above, a no-op here: handlers are worklets driven by native keyboard events
  // that never fire under Jest, so consumers keep their initial state.
  useGenericKeyboardHandler: jest.fn(),
  useReanimatedKeyboardAnimation: jest.fn(() => ({
    height: { value: 0 },
    progress: { value: 0 },
  })),
  // No keyboard is ever up under Jest.
  useKeyboardState: jest.fn(selector => {
    const state = { isVisible: false, height: 0 };
    return selector ? selector(state) : state;
  }),
  KeyboardAvoidingView: require('react-native').View,
  KeyboardStickyView: require('react-native').View,
  KeyboardAwareScrollView: require('react-native').ScrollView,
}));
