'use no memo';
/* eslint-disable no-undef */
/**
 * Jest Global Setup
 *
 * Provides mocks for native modules that aren't available in the Jest environment.
 * These mocks are loaded via setupFilesAfterEnv in jest.config.js.
 */

// ---------------------------------------------------------------------------
// react-native-nitro-modules (must be before unistyles since it depends on it)
// ---------------------------------------------------------------------------
jest.mock('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// react-native-unistyles
// ---------------------------------------------------------------------------
jest.mock('react-native-unistyles', () => {
  const { lightTheme } = require('./src/theme/themes');

  return {
    StyleSheet: {
      create: styleFnOrObj => {
        if (typeof styleFnOrObj === 'function') {
          return styleFnOrObj(lightTheme);
        }
        return styleFnOrObj;
      },
      configure: jest.fn(),
    },
    useUnistyles: jest.fn(() => ({
      theme: lightTheme,
      styles: {},
    })),
    useStyles: jest.fn(stylesheet => ({
      styles:
        typeof stylesheet === 'function'
          ? stylesheet(lightTheme)
          : stylesheet || {},
      theme: lightTheme,
    })),
    useInitialTheme: jest.fn(),
    withUnistyles: jest.fn(component => component),
    UnistylesRuntime: {
      setTheme: jest.fn(),
      getTheme: jest.fn(() => lightTheme),
      colorScheme: 'light',
      themeName: 'light',
      contentSizeCategory: 'Medium',
      breakpoint: undefined,
      orientation: 'portrait',
      pixelRatio: 2,
      fontScale: 1,
      screen: { width: 390, height: 844 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
      statusBar: { width: 390, height: 44 },
      navigationBar: { width: 390, height: 0 },
    },
  };
});

// ---------------------------------------------------------------------------
// react-native-reanimated
// ---------------------------------------------------------------------------
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const noOp = jest.fn();
  const returnSelf = jest.fn(function () {
    return this;
  });
  const mockSharedValue = initialValue => {
    const sv = {
      value: initialValue,
      addListener: noOp,
      removeListener: noOp,
      modify: noOp,
      get: jest.fn(() => sv.value),
      set: jest.fn(v => {
        sv.value = v;
      }),
    };
    return sv;
  };

  return {
    __esModule: true,
    default: {
      createAnimatedComponent: component => component,
      addWhitelistedNativeProps: noOp,
      addWhitelistedUIProps: noOp,
      call: noOp,
      event: noOp,
      Value: jest.fn(() => ({ setValue: noOp })),
      Node: jest.fn(),
      View: View,
      Text: require('react-native').Text,
      Image: require('react-native').Image,
      ScrollView: require('react-native').ScrollView,
      FlatList: require('react-native').FlatList,
    },
    useSharedValue: jest.fn(mockSharedValue),
    useAnimatedStyle: jest.fn(() => ({})),
    useAnimatedProps: jest.fn(() => ({})),
    useDerivedValue: jest.fn(fn => mockSharedValue(fn())),
    useAnimatedGestureHandler: jest.fn(() => ({})),
    useAnimatedScrollHandler: jest.fn(() => ({})),
    useAnimatedRef: jest.fn(() => ({ current: null })),
    useReducedMotion: jest.fn(() => false),
    withTiming: jest.fn(toValue => toValue),
    withSpring: jest.fn(toValue => toValue),
    withDecay: jest.fn(config => config),
    withDelay: jest.fn((_, animation) => animation),
    withSequence: jest.fn((...animations) => animations[animations.length - 1]),
    withRepeat: jest.fn(animation => animation),
    cancelAnimation: noOp,
    Easing: {
      linear: noOp,
      ease: noOp,
      quad: noOp,
      cubic: noOp,
      poly: noOp,
      sin: noOp,
      circle: noOp,
      exp: noOp,
      elastic: noOp,
      back: noOp,
      bounce: noOp,
      bezier: jest.fn(() => noOp),
      bezierFn: jest.fn(() => noOp),
      steps: jest.fn(() => noOp),
      in: noOp,
      out: noOp,
      inOut: noOp,
    },
    Extrapolation: { EXTEND: 'extend', CLAMP: 'clamp', IDENTITY: 'identity' },
    interpolate: jest.fn(value => value),
    interpolateColor: jest.fn(() => 'rgba(0,0,0,0)'),
    runOnUI: jest.fn(fn => fn),
    createAnimatedComponent: component => component,
    FadeIn: { duration: returnSelf, delay: returnSelf, springify: returnSelf },
    FadeOut: { duration: returnSelf, delay: returnSelf, springify: returnSelf },
    FadeInDown: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    FadeInUp: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    FadeOutDown: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    FadeOutUp: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    SlideInRight: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    SlideOutRight: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    SlideInLeft: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    SlideOutLeft: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    ZoomIn: { duration: returnSelf, delay: returnSelf, springify: returnSelf },
    ZoomOut: { duration: returnSelf, delay: returnSelf, springify: returnSelf },
    Layout: { duration: returnSelf, delay: returnSelf, springify: returnSelf },
    LinearTransition: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    SequencedTransition: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    EntryExitTransition: {
      duration: returnSelf,
      delay: returnSelf,
      springify: returnSelf,
    },
    measure: jest.fn(() => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      pageX: 0,
      pageY: 0,
    })),
    scrollTo: noOp,
    setGestureState: noOp,
  };
});

// ---------------------------------------------------------------------------
// react-native-mmkv
// ---------------------------------------------------------------------------
jest.mock('react-native-mmkv', () => {
  const createInstance = () => {
    const store = new Map();
    return {
      set: jest.fn((key, value) => store.set(key, value)),
      getString: jest.fn(key => store.get(key)),
      getNumber: jest.fn(key => store.get(key)),
      getBoolean: jest.fn(key => store.get(key)),
      delete: jest.fn(key => store.delete(key)),
      remove: jest.fn(key => store.delete(key)),
      contains: jest.fn(key => store.has(key)),
      clearAll: jest.fn(() => store.clear()),
      getAllKeys: jest.fn(() => [...store.keys()]),
    };
  };
  return {
    MMKV: jest.fn().mockImplementation(createInstance),
    createMMKV: jest.fn().mockImplementation(createInstance),
  };
});

// ---------------------------------------------------------------------------
// @shopify/react-native-skia
// ---------------------------------------------------------------------------
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Group: 'Group',
  Path: 'Path',
  RoundedRect: 'RoundedRect',
  Circle: 'Circle',
  Rect: 'Rect',
  Line: 'Line',
  Text: 'SkiaText',
  useFont: jest.fn(() => null),
  useValue: jest.fn(() => ({ current: 0 })),
  Skia: {
    Path: {
      Make: () => ({
        moveTo: jest.fn().mockReturnThis(),
        lineTo: jest.fn().mockReturnThis(),
        quadTo: jest.fn().mockReturnThis(),
        cubicTo: jest.fn().mockReturnThis(),
        close: jest.fn().mockReturnThis(),
        addCircle: jest.fn().mockReturnThis(),
        reset: jest.fn().mockReturnThis(),
      }),
    },
    Color: jest.fn(c => c),
  },
}));

// ---------------------------------------------------------------------------
// react-native-safe-area-context
// ---------------------------------------------------------------------------
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, bottom: 0, left: 0, right: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: jest.fn(() => insets),
    useSafeAreaFrame: jest.fn(() => frame),
    SafeAreaInsetsContext: {
      Consumer: ({ children }) => children(insets),
    },
    initialWindowMetrics: { insets, frame },
  };
});

// ---------------------------------------------------------------------------
// @react-navigation/native
// ---------------------------------------------------------------------------
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      dispatch: jest.fn(),
      reset: jest.fn(),
      canGoBack: jest.fn(() => true),
      addListener: jest.fn(() => jest.fn()),
      removeListener: jest.fn(),
      getParent: jest.fn(),
      getState: jest.fn(() => ({
        routes: [],
        index: 0,
      })),
    })),
    useRoute: jest.fn(() => ({
      params: {},
      key: 'test-key',
      name: 'TestScreen',
    })),
    useFocusEffect: jest.fn(cb => cb()),
    useIsFocused: jest.fn(() => true),
    NavigationContainer: ({ children }) => children,
    createNavigationContainerRef: jest.fn(() => ({
      current: null,
      isReady: jest.fn(() => true),
    })),
    CommonActions: {
      navigate: jest.fn(),
      reset: jest.fn(),
      goBack: jest.fn(),
    },
  };
});

// ---------------------------------------------------------------------------
// react-native-gesture-handler
// ---------------------------------------------------------------------------
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
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
      })),
      Tap: jest.fn(() => ({
        onStart: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
        enabled: jest.fn().mockReturnThis(),
        maxDuration: jest.fn().mockReturnThis(),
      })),
      Simultaneous: jest.fn((...gestures) => gestures),
      Exclusive: jest.fn((...gestures) => gestures),
      Race: jest.fn((...gestures) => gestures),
    },
    GestureDetector: View,
  };
});

// Sub-path imports within gesture-handler that bypass the main mock
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const View = require('react-native').View;
  return { __esModule: true, default: View };
});

// ---------------------------------------------------------------------------
// @gorhom/bottom-sheet
// ---------------------------------------------------------------------------
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
      return React.createElement(View, props);
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
  };
});

// ---------------------------------------------------------------------------
// react-native-config
// ---------------------------------------------------------------------------
jest.mock('react-native-config', () => ({
  API_URL: 'http://localhost:4000',
  WS_URL: 'ws://localhost:4000',
  ENV: 'test',
}));

// ---------------------------------------------------------------------------
// react-native-keychain
// ---------------------------------------------------------------------------
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(() => Promise.resolve(true)),
  getGenericPassword: jest.fn(() => Promise.resolve(false)),
  resetGenericPassword: jest.fn(() => Promise.resolve(true)),
  setInternetCredentials: jest.fn(() => Promise.resolve(true)),
  getInternetCredentials: jest.fn(() => Promise.resolve(false)),
  resetInternetCredentials: jest.fn(() => Promise.resolve(true)),
  ACCESSIBLE: {
    WHEN_UNLOCKED: 'AccessibleWhenUnlocked',
    AFTER_FIRST_UNLOCK: 'AccessibleAfterFirstUnlock',
    ALWAYS: 'AccessibleAlways',
    WHEN_PASSCODE_SET_THIS_DEVICE_ONLY:
      'AccessibleWhenPasscodeSetThisDeviceOnly',
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
      'AccessibleAfterFirstUnlockThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    USER_PRESENCE: 'UserPresence',
    BIOMETRY_ANY: 'BiometryAny',
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
    DEVICE_PASSCODE: 'DevicePasscode',
  },
  AUTHENTICATION_TYPE: {
    DEVICE_PASSCODE_OR_BIOMETRICS: 'AuthenticationWithBiometricsDevicePasscode',
    BIOMETRICS: 'AuthenticationWithBiometrics',
  },
  SECURITY_LEVEL: {
    SECURE_SOFTWARE: 'SecureSoftware',
    SECURE_HARDWARE: 'SecureHardware',
    ANY: 'Any',
  },
  getSupportedBiometryType: jest.fn(() => Promise.resolve('FaceID')),
  canImplyAuthentication: jest.fn(() => Promise.resolve(true)),
}));

// ---------------------------------------------------------------------------
// @shopify/flash-list
// ---------------------------------------------------------------------------
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return {
    FlashList: FlatList,
    MasonryFlashList: FlatList,
  };
});

// ---------------------------------------------------------------------------
// react-native-worklets
// ---------------------------------------------------------------------------
jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(),
  runOnRuntime: jest.fn(),
  useWorklet: jest.fn(),
}));

// ---------------------------------------------------------------------------
// @callstack/liquid-glass
// ---------------------------------------------------------------------------
jest.mock('@callstack/liquid-glass', () => {
  const View = require('react-native').View;
  return {
    LiquidGlassView: View,
  };
});

// ---------------------------------------------------------------------------
// react-native-device-info
// ---------------------------------------------------------------------------
jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '1'),
  getUniqueId: jest.fn(() => Promise.resolve('test-device-id')),
  getDeviceId: jest.fn(() => 'test-device'),
  getSystemName: jest.fn(() => 'iOS'),
  getSystemVersion: jest.fn(() => '17.0'),
  getBrand: jest.fn(() => 'Apple'),
  getModel: jest.fn(() => 'iPhone 15'),
  isEmulator: jest.fn(() => Promise.resolve(false)),
  getApplicationName: jest.fn(() => 'SousChef'),
  getBundleId: jest.fn(() => 'com.souschef.app'),
}));

// ---------------------------------------------------------------------------
// @notifee/react-native
// ---------------------------------------------------------------------------
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(() =>
      Promise.resolve({ authorizationStatus: 1 }),
    ),
    getNotificationSettings: jest.fn(() =>
      Promise.resolve({ authorizationStatus: 1 }),
    ),
    displayNotification: jest.fn(() => Promise.resolve('notification-id')),
    cancelNotification: jest.fn(() => Promise.resolve()),
    cancelAllNotifications: jest.fn(() => Promise.resolve()),
    createChannel: jest.fn(() => Promise.resolve('channel-id')),
    setBadgeCount: jest.fn(() => Promise.resolve()),
    getBadgeCount: jest.fn(() => Promise.resolve(0)),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
  EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3 },
  AuthorizationStatus: {
    AUTHORIZED: 1,
    DENIED: 0,
    NOT_DETERMINED: -1,
    PROVISIONAL: 2,
  },
}));

// ---------------------------------------------------------------------------
// react-native-permissions
// ---------------------------------------------------------------------------
jest.mock('react-native-permissions', () => ({
  check: jest.fn(() => Promise.resolve('granted')),
  request: jest.fn(() => Promise.resolve('granted')),
  PERMISSIONS: {
    IOS: {
      CAMERA: 'ios.permission.CAMERA',
      PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
    },
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
    },
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
    LIMITED: 'limited',
  },
}));

// ---------------------------------------------------------------------------
// react-native-vision-camera
// ---------------------------------------------------------------------------
jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: jest.fn(() => null),
  useCameraPermission: jest.fn(() => ({
    hasPermission: true,
    requestPermission: jest.fn(),
  })),
  useCodeScanner: jest.fn(),
}));

// ---------------------------------------------------------------------------
// react-native-image-picker
// ---------------------------------------------------------------------------
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

// ---------------------------------------------------------------------------
// @react-native-clipboard/clipboard
// ---------------------------------------------------------------------------
jest.mock('@react-native-clipboard/clipboard', () => ({
  getString: jest.fn(() => Promise.resolve('')),
  setString: jest.fn(),
}));

// ---------------------------------------------------------------------------
// react-native-keyboard-controller
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// react-native-turbo-image
// ---------------------------------------------------------------------------
jest.mock('react-native-turbo-image', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: View,
  };
});

// ---------------------------------------------------------------------------
// @react-native-vector-icons
// ---------------------------------------------------------------------------
const MockIcon = 'Icon';
jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: MockIcon,
  Ionicons: MockIcon,
}));

// ---------------------------------------------------------------------------
// @react-native-community/image-editor
// ---------------------------------------------------------------------------
jest.mock('@react-native-community/image-editor', () => ({
  __esModule: true,
  default: {
    cropImage: jest.fn(() => Promise.resolve('cropped-image-uri')),
  },
}));

// ---------------------------------------------------------------------------
// @react-native-community/netinfo
// ---------------------------------------------------------------------------
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() =>
      Promise.resolve({ isConnected: true, isInternetReachable: true }),
    ),
  },
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: 'wifi',
  })),
  NetInfoStateType: { wifi: 'wifi', cellular: 'cellular', none: 'none' },
}));

// ---------------------------------------------------------------------------
// react-native-launch-arguments
// ---------------------------------------------------------------------------
jest.mock('react-native-launch-arguments', () => ({
  LaunchArguments: { value: jest.fn(() => ({})) },
}));

// ---------------------------------------------------------------------------
// react-native-performance
// ---------------------------------------------------------------------------
jest.mock('react-native-performance', () => {
  const entries = [];
  const performance = {
    timeOrigin: 0,
    now: jest.fn(() => Date.now()),
    mark: jest.fn(name => {
      const entry = {
        name,
        entryType: 'mark',
        startTime: Date.now(),
        duration: 0,
      };
      entries.push(entry);
      return entry;
    }),
    measure: jest.fn(name => {
      const entry = {
        name,
        entryType: 'measure',
        startTime: Date.now(),
        duration: 0,
      };
      entries.push(entry);
      return entry;
    }),
    metric: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    clearMetrics: jest.fn(),
    clearResourceTimings: jest.fn(),
    getEntries: jest.fn(() => []),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
  };

  return {
    __esModule: true,
    default: performance,
    PerformanceObserver: jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn(() => []),
    })),
    setResourceLoggingEnabled: jest.fn(),
  };
});

// ---------------------------------------------------------------------------
// Suppress noisy warnings in test output
// ---------------------------------------------------------------------------
const originalConsoleWarn = console.warn;
console.warn = (...args) => {
  // Suppress known noisy warnings in tests
  const message = typeof args[0] === 'string' ? args[0] : '';
  if (
    message.includes('Animated: `useNativeDriver`') ||
    message.includes('componentWillReceiveProps') ||
    message.includes('componentWillMount') ||
    message.includes('Query complexity error') ||
    message.includes('Invalid date format')
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

const originalConsoleLog = console.log;
console.log = (...args) => {
  const message = typeof args[0] === 'string' ? args[0] : '';
  if (
    message.includes('Retrying with reduced pagination') ||
    message.includes('Cache: Version mismatch') ||
    message.includes('Cache: Cleared persisted cache')
  ) {
    return;
  }
  originalConsoleLog(...args);
};
