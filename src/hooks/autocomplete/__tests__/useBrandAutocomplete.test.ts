import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { SearchBrandsDocument } from '#operations/item/item.generated';
import type { RootState } from '#store/index';
import { useBrandAutocomplete } from '../useBrandAutocomplete';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

let mockIsOnline = true;
jest.mock('#store/useAppStore', () => {
  const getState = () => ({ isOnline: mockIsOnline, cachedBrands: [] });
  return {
    useAppStore: <T>(selector: (state: RootState) => T): T =>
      selector(getState() as Partial<RootState> as RootState),
    useIsOnline: () => getState().isOnline,
  };
});

const suggestedBrands = [
  { id: 'b1', name: 'Heinz' },
  { id: 'b2', name: 'Hellmann' },
  { id: 'b3', name: 'Kraft' },
];

/**
 * Per CLAUDE.md "Apollo Test Patterns": fire-spy assertions like
 * `mockSearchBrands.toHaveBeenCalledWith({ variables: ... })` are replaced by
 * a `variables: () => true` matcher that records each invocation into a
 * closure array. The array is then asserted directly. This exercises the real
 * useLazyQuery → MockLink path instead of stubbing useLazyQuery wholesale.
 */
function createSearchBrandsMock(
  recorded: Array<Record<string, unknown>>,
): MockedResponse {
  return {
    request: {
      query: SearchBrandsDocument,
      variables: vars => {
        recorded.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      data: { brands: { __typename: 'BrandConnection', edges: [] } },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockIsOnline = true;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useBrandAutocomplete', () => {
  it('returns suggested brands as displayItems initially when provided', () => {
    const { result } = renderHookWithApollo(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    expect(result.current.displayItems).toHaveLength(3);
    expect(result.current.displayItems[0]).toEqual(
      expect.objectContaining({ id: 'b1', name: 'Heinz', isSuggested: true }),
    );
  });

  it('returns empty displayItems when no suggestedBrands and no search', () => {
    const { result } = renderHookWithApollo(() => useBrandAutocomplete());

    expect(result.current.displayItems).toEqual([]);
  });

  it('filters suggested brands by search term', () => {
    const { result } = renderHookWithApollo(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    act(() => {
      result.current.handleSearchTermChange('hei');
    });

    const names = result.current.displayItems.map(i => i.name);
    expect(names).toContain('Heinz');
    expect(names).not.toContain('Kraft');
  });

  it('returns all suggested brands when search term is empty', () => {
    const { result } = renderHookWithApollo(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    expect(result.current.displayItems).toHaveLength(3);
    result.current.displayItems.forEach(item => {
      expect(item.isSuggested).toBe(true);
    });
  });

  it('returns empty searchTerm initially', () => {
    const { result } = renderHookWithApollo(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    expect(result.current.searchTerm).toBe('');
  });

  it('updates searchTerm via handleSearchTermChange', () => {
    const { result } = renderHookWithApollo(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    act(() => {
      result.current.handleSearchTermChange('test');
    });

    expect(result.current.searchTerm).toBe('test');
  });

  it('triggers lazy query search after debounce when term has no local matches', () => {
    const recordedVariables: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () => useBrandAutocomplete({ suggestedBrands }),
      { operationMocks: [createSearchBrandsMock(recordedVariables)] },
    );

    act(() => {
      result.current.handleSearchTermChange('xy');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(recordedVariables).toContainEqual({ search: 'xy', limit: 20 });
  });

  it('does NOT trigger lazy query when local suggestions match the search term', () => {
    const recordedVariables: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () => useBrandAutocomplete({ suggestedBrands }),
      { operationMocks: [createSearchBrandsMock(recordedVariables)] },
    );

    act(() => {
      result.current.handleSearchTermChange('he');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(recordedVariables).toEqual([]);
    const names = result.current.displayItems.map(i => i.name);
    expect(names).toContain('Heinz');
    expect(names).toContain('Hellmann');
  });

  it('resets state when reset is called', () => {
    const { result } = renderHookWithApollo(() =>
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
    const { result } = renderHookWithApollo(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    result.current.displayItems.forEach(item => {
      expect(item.isSuggested).toBe(true);
    });
  });

  it('sets shouldSearch to true when searchTerm meets minChars and is online', () => {
    const { result } = renderHookWithApollo(() =>
      useBrandAutocomplete({ suggestedBrands }),
    );

    act(() => {
      result.current.handleSearchTermChange('ab');
    });

    expect(result.current.shouldSearch).toBe(true);
  });
});
