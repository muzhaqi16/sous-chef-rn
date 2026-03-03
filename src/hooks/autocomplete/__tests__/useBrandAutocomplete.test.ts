import { renderHook, act } from '@testing-library/react-native';
import { useBrandAutocomplete } from '../useBrandAutocomplete';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

let mockIsOnline = true;
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({ isOnline: mockIsOnline }),
}));

const mockSearchBrands = jest.fn();
let mockBrandsData: any = null;
let mockBrandsLoading = false;

jest.mock('#generated', () => ({
  useSearchBrandsLazyQuery: () => [
    mockSearchBrands,
    { data: mockBrandsData, loading: mockBrandsLoading },
  ],
}));

const suggestedBrands = [
  { id: 'b1', name: 'Heinz' },
  { id: 'b2', name: 'Hellmann' },
  { id: 'b3', name: 'Kraft' },
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockIsOnline = true;
  mockBrandsData = null;
  mockBrandsLoading = false;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useBrandAutocomplete', () => {
  it('returns suggested brands as displayItems initially when provided', () => {
    const { result } = renderHook(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    expect(result.current.displayItems).toHaveLength(3);
    expect(result.current.displayItems[0]).toEqual(
      expect.objectContaining({ id: 'b1', name: 'Heinz', isSuggested: true }),
    );
  });

  it('returns empty displayItems when no suggestedBrands and no search', () => {
    const { result } = renderHook(() => useBrandAutocomplete());

    expect(result.current.displayItems).toEqual([]);
  });

  it('filters suggested brands by search term', () => {
    const { result } = renderHook(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    act(() => {
      result.current.handleSearchTermChange('hei');
    });

    // Should filter to only Heinz
    const names = result.current.displayItems.map(i => i.name);
    expect(names).toContain('Heinz');
    expect(names).not.toContain('Kraft');
  });

  it('returns all suggested brands when search term is empty', () => {
    const { result } = renderHook(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    expect(result.current.displayItems).toHaveLength(3);
    result.current.displayItems.forEach(item => {
      expect(item.isSuggested).toBe(true);
    });
  });

  it('returns empty searchTerm initially', () => {
    const { result } = renderHook(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    expect(result.current.searchTerm).toBe('');
  });

  it('updates searchTerm via handleSearchTermChange', () => {
    const { result } = renderHook(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    act(() => {
      result.current.handleSearchTermChange('test');
    });

    expect(result.current.searchTerm).toBe('test');
  });

  it('triggers lazy query search after debounce when term meets minChars', () => {
    const { result } = renderHook(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    act(() => {
      result.current.handleSearchTermChange('he');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearchBrands).toHaveBeenCalledWith({
      variables: { search: 'he', limit: 20 },
    });
  });

  it('resets state when reset is called', () => {
    const { result } = renderHook(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    act(() => {
      result.current.handleSearchTermChange('kraft');
    });
    expect(result.current.searchTerm).toBe('kraft');

    act(() => {
      result.current.reset();
    });

    expect(result.current.searchTerm).toBe('');
  });

  it('marks suggested brands with isSuggested: true', () => {
    const { result } = renderHook(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    result.current.displayItems.forEach(item => {
      expect(item.isSuggested).toBe(true);
    });
  });

  it('sets shouldSearch to true when searchTerm meets minChars and is online', () => {
    const { result } = renderHook(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    act(() => {
      result.current.handleSearchTermChange('ab');
    });

    expect(result.current.shouldSearch).toBe(true);
  });
});
