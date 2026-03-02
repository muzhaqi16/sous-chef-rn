import { renderHook, act } from '@testing-library/react-native';
import { useItemAutocomplete } from '../useItemAutocomplete';

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

const mockFetchItems = jest.fn();
let mockItemData: any = null;
let mockItemLoading = false;

jest.mock('#generated', () => ({
  useAutocompleteItemsLazyQuery: () => [
    mockFetchItems,
    { data: mockItemData, loading: mockItemLoading },
  ],
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockIsOnline = true;
  mockItemData = null;
  mockItemLoading = false;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useItemAutocomplete', () => {
  it('returns empty displayItems initially', () => {
    const { result } = renderHook(() => useItemAutocomplete());

    expect(result.current.displayItems).toEqual([]);
  });

  it('returns empty searchTerm initially', () => {
    const { result } = renderHook(() => useItemAutocomplete());

    expect(result.current.searchTerm).toBe('');
  });

  it('updates searchTerm via handleSearchTermChange', () => {
    const { result } = renderHook(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('milk');
    });

    expect(result.current.searchTerm).toBe('milk');
  });

  it('triggers lazy query after debounce when term meets minChars', () => {
    const { result } = renderHook(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('mi');
    });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(mockFetchItems).toHaveBeenCalledWith({
      variables: { input: { query: 'mi', limit: 10 } },
    });
  });

  it('uses custom debounceMs when provided', () => {
    const { result } = renderHook(() =>
      useItemAutocomplete({ debounceMs: 500 }),
    );

    act(() => {
      result.current.handleSearchTermChange('egg');
    });

    // At 250ms, should not have fired yet
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(mockFetchItems).not.toHaveBeenCalled();

    // At 500ms, should fire
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(mockFetchItems).toHaveBeenCalledWith({
      variables: { input: { query: 'egg', limit: 10 } },
    });
  });

  it('does not trigger search when term is below minChars', () => {
    const { result } = renderHook(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('m');
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockFetchItems).not.toHaveBeenCalled();
  });

  it('sets shouldSearch to true when searchTerm meets minChars and is online', () => {
    const { result } = renderHook(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('ab');
    });

    expect(result.current.shouldSearch).toBe(true);
  });

  it('sets shouldSearch to false when offline', () => {
    mockIsOnline = false;
    const { result } = renderHook(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('milk');
    });

    expect(result.current.shouldSearch).toBe(false);
  });

  it('resets state when reset is called', () => {
    const { result } = renderHook(() => useItemAutocomplete());

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
    const { result } = renderHook(() => useItemAutocomplete());

    expect(result.current.isLoading).toBe(false);
  });
});
