import { renderHook, act } from '@testing-library/react-native';
import { useSafeNavigation, safeGoBack } from '../useSafeNavigation';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
const mockDispatch = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
    dispatch: mockDispatch,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
});

describe('safeGoBack', () => {
  it('calls goBack when canGoBack returns true', () => {
    const navigation = {
      canGoBack: () => true,
      goBack: mockGoBack,
    } as any;

    safeGoBack(navigation);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('does not call goBack when canGoBack returns false', () => {
    const navigation = {
      canGoBack: () => false,
      goBack: mockGoBack,
    } as any;

    safeGoBack(navigation);
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});

describe('useSafeNavigation', () => {
  it('returns navigation, canGoBack, and goBack', () => {
    const { result } = renderHook(() => useSafeNavigation());

    expect(result.current.navigation).toBeDefined();
    expect(result.current.canGoBack).toBe(true);
    expect(typeof result.current.goBack).toBe('function');
  });

  it('canGoBack reflects navigation.canGoBack()', () => {
    mockCanGoBack.mockReturnValue(false);
    const { result } = renderHook(() => useSafeNavigation());
    expect(result.current.canGoBack).toBe(false);
  });

  it('goBack calls navigation.goBack when canGoBack is true', () => {
    mockCanGoBack.mockReturnValue(true);
    const { result } = renderHook(() => useSafeNavigation());

    act(() => {
      result.current.goBack();
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('goBack does not call navigation.goBack when canGoBack is false', () => {
    mockCanGoBack.mockReturnValue(false);
    const { result } = renderHook(() => useSafeNavigation());

    act(() => {
      result.current.goBack();
    });

    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
