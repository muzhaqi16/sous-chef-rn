'use no memo';
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardProvider: ({ children }) => children,
  useKeyboardHandler: jest.fn(),
  useReanimatedKeyboardAnimation: jest.fn(() => ({
    height: { value: 0 },
    progress: { value: 0 },
  })),
  KeyboardAvoidingView: require('react-native').View,
  KeyboardStickyView: require('react-native').View,
}));
