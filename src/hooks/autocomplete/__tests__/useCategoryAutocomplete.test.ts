import { renderHook, act } from '@testing-library/react-native';
import { useCategoryAutocomplete } from '../useCategoryAutocomplete';

jest.mock('../../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

let mockIsOnline = true;
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({ isOnline: mockIsOnline }),
}));

const mockSearchCategories = jest.fn();
let mockCategoryData: any = null;
let mockCategoryLoading = false;

jest.mock('#generated', () => ({
  useAutocompleteCategoriesLazyQuery: () => [
    mockSearchCategories,
    { data: mockCategoryData, loading: mockCategoryLoading },
  ],
  CategoryType: {
    Cuisine: 'CUISINE',
    Custom: 'CUSTOM',
    Dietary: 'DIETARY',
    General: 'GENERAL',
    MealType: 'MEAL_TYPE',
    Storage: 'STORAGE',
    System: 'SYSTEM',
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockIsOnline = true;
  mockCategoryData = null;
  mockCategoryLoading = false;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useCategoryAutocomplete', () => {
  it('returns empty displayItems initially', () => {
    const { result } = renderHook(() => useCategoryAutocomplete());

    expect(result.current.displayItems).toEqual([]);
  });

  it('returns empty searchTerm initially', () => {
    const { result } = renderHook(() => useCategoryAutocomplete());

    expect(result.current.searchTerm).toBe('');
  });

  it('updates searchTerm via handleSearchTermChange', () => {
    const { result } = renderHook(() => useCategoryAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('dairy');
    });

    expect(result.current.searchTerm).toBe('dairy');
  });

  it('triggers lazy query after debounce when term meets minChars', () => {
    const { result } = renderHook(() => useCategoryAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('da');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearchCategories).toHaveBeenCalledWith({
      variables: {
        input: {
          query: 'da',
          limit: 5,
          type: 'GENERAL',
        },
      },
    });
  });

  it('uses custom categoryType when provided', () => {
    const { result } = renderHook(() =>
      useCategoryAutocomplete({ categoryType: 'CUISINE' as any }),
    );

    act(() => {
      result.current.handleSearchTermChange('ital');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearchCategories).toHaveBeenCalledWith({
      variables: {
        input: {
          query: 'ital',
          limit: 5,
          type: 'CUISINE',
        },
      },
    });
  });

  it('does not trigger search when term is below minChars', () => {
    const { result } = renderHook(() => useCategoryAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('d');
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockSearchCategories).not.toHaveBeenCalled();
  });

  it('sets shouldSearch to true when searchTerm meets minChars and is online', () => {
    const { result } = renderHook(() => useCategoryAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('ab');
    });

    expect(result.current.shouldSearch).toBe(true);
  });

  it('sets shouldSearch to false when offline', () => {
    mockIsOnline = false;
    const { result } = renderHook(() => useCategoryAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('dairy');
    });

    expect(result.current.shouldSearch).toBe(false);
  });

  it('resets state when reset is called', () => {
    const { result } = renderHook(() => useCategoryAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('test');
    });
    expect(result.current.searchTerm).toBe('test');

    act(() => {
      result.current.reset();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.displayItems).toEqual([]);
  });

  it('returns isLoading false when query is not loading', () => {
    const { result } = renderHook(() => useCategoryAutocomplete());

    expect(result.current.isLoading).toBe(false);
  });
});
