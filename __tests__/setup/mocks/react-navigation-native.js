'use no memo';
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
