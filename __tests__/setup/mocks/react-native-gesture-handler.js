'use no memo';
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Pressable: require('react-native').Pressable,
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: require('react-native').ScrollView,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    RawButton: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    FlatList: require('react-native').FlatList,
    gestureHandlerRootHOC: jest.fn(c => c),
    Directions: {},
    GestureHandlerRootView: View,
    Gesture: {
      Pan: jest.fn(() => ({
        onStart: jest.fn().mockReturnThis(),
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
        onFinalize: jest.fn().mockReturnThis(),
        onChange: jest.fn().mockReturnThis(),
        enabled: jest.fn().mockReturnThis(),
        activeOffsetX: jest.fn().mockReturnThis(),
        activeOffsetY: jest.fn().mockReturnThis(),
        failOffsetX: jest.fn().mockReturnThis(),
        failOffsetY: jest.fn().mockReturnThis(),
        minDistance: jest.fn().mockReturnThis(),
        averageTouches: jest.fn().mockReturnThis(),
        maxPointers: jest.fn().mockReturnThis(),
        minPointers: jest.fn().mockReturnThis(),
      })),
      Tap: jest.fn(() => ({
        onStart: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
        enabled: jest.fn().mockReturnThis(),
        maxDuration: jest.fn().mockReturnThis(),
        numberOfTaps: jest.fn().mockReturnThis(),
      })),
      Pinch: jest.fn(() => ({
        onStart: jest.fn().mockReturnThis(),
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
        onChange: jest.fn().mockReturnThis(),
        enabled: jest.fn().mockReturnThis(),
      })),
      Simultaneous: jest.fn((...gestures) => gestures),
      Exclusive: jest.fn((...gestures) => gestures),
      Race: jest.fn((...gestures) => gestures),
    },
    // v3 hook-based gesture API: each hook returns the config it was passed so
    // tests can read config props (minDistance, activeOffsetX, enabled) and
    // invoke config callbacks (onActivate, onUpdate, onDeactivate) directly.
    usePanGesture: jest.fn(config => config),
    usePinchGesture: jest.fn(config => config),
    useTapGesture: jest.fn(config => config),
    useLongPressGesture: jest.fn(config => config),
    useSimultaneousGestures: jest.fn((...gestures) => gestures),
    useExclusiveGestures: jest.fn((...gestures) => gestures),
    useCompetingGestures: jest.fn((...gestures) => gestures),
    GestureDetector: View,
  };
});

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const View = require('react-native').View;
  return { __esModule: true, default: View };
});
