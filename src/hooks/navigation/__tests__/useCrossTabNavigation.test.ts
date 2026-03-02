import { renderHook, act } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { useCrossTabNavigation } from '../useCrossTabNavigation';

const mockDispatch = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);
const mockParentDispatch = jest.fn();
const mockGetParent = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      dispatch: mockDispatch,
      goBack: mockGoBack,
      canGoBack: mockCanGoBack,
      getParent: mockGetParent,
    }),
    useRoute: () => ({
      name: 'TestScreen',
      params: {},
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  mockGetParent.mockReturnValue({
    dispatch: mockParentDispatch,
  });
});

describe('useCrossTabNavigation', () => {
  it('calls goBack when no source is provided', () => {
    const { result } = renderHook(() => useCrossTabNavigation('PantryMain'));

    act(() => {
      result.current.goBackToSource();
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('calls goBack when source has no sourceTab', () => {
    const { result } = renderHook(() => useCrossTabNavigation('PantryMain'));

    act(() => {
      result.current.goBackToSource({});
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('calls goBack for tab-to-tab navigation (no fromModalStack)', () => {
    const { result } = renderHook(() => useCrossTabNavigation('PantryMain'));

    act(() => {
      result.current.goBackToSource({
        sourceTab: 'ShoppingList',
        fromModalStack: false,
      });
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockParentDispatch).not.toHaveBeenCalled();
  });

  it('navigates via parent for modal dismissal (fromModalStack: true)', () => {
    const { result } = renderHook(() => useCrossTabNavigation('PantryMain'));

    act(() => {
      result.current.goBackToSource({
        sourceTab: 'Pantry',
        fromModalStack: true,
      });
    });

    expect(mockParentDispatch).toHaveBeenCalledWith(
      CommonActions.navigate({
        name: 'Home',
        params: {
          screen: 'Pantry',
        },
      }),
    );
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('navigates to correct source tab in modal dismissal', () => {
    const { result } = renderHook(() => useCrossTabNavigation('SearchResults'));

    act(() => {
      result.current.goBackToSource({
        sourceTab: 'ShoppingList',
        fromModalStack: true,
      });
    });

    expect(mockParentDispatch).toHaveBeenCalledWith(
      CommonActions.navigate({
        name: 'Home',
        params: {
          screen: 'ShoppingList',
        },
      }),
    );
  });

  it('falls back to goBack when parent navigator is not available for modal dismissal', () => {
    mockGetParent.mockReturnValue(null);
    const { result } = renderHook(() => useCrossTabNavigation('SearchResults'));

    act(() => {
      result.current.goBackToSource({
        sourceTab: 'Pantry',
        fromModalStack: true,
      });
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('handles sourceTab without fromModalStack as tab-to-tab', () => {
    const { result } = renderHook(() => useCrossTabNavigation('RecipeCreate'));

    act(() => {
      result.current.goBackToSource({
        sourceTab: 'Recipe',
      });
    });

    // fromModalStack is undefined (falsy), so should use goBack
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockParentDispatch).not.toHaveBeenCalled();
  });
});
