import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { AutocompleteCategoriesDocument } from '#operations/item/item.generated';
import { CategoryType } from '#/graphql/generated/schemaTypes';
import type { RootState } from '#store/index';
import { useCategoryAutocomplete } from '../useCategoryAutocomplete';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

let mockIsOnline = true;
let mockCachedCategories: RootState['cachedCategories'] = [];
jest.mock('#store/useAppStore', () => {
  const getState = (): Partial<RootState> => ({
    isOnline: mockIsOnline,
    cachedCategories: mockCachedCategories,
  });
  return {
    useAppStore: (selector: (state: RootState) => unknown) =>
      selector(getState() as RootState),
    useIsOnline: () => getState().isOnline,
  };
});

/**
 * Per CLAUDE.md "Apollo Test Patterns": fire-spy assertions like
 * `mockSearchCategories.toHaveBeenCalledWith(...)` are replaced by a
 * `variables: () => true` matcher that records each invocation into a
 * closure array.
 */
function createMock(recorded: Array<Record<string, unknown>>): MockedResponse {
  return {
    request: {
      query: AutocompleteCategoriesDocument,
      variables: vars => {
        recorded.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: { data: { autocompleteCategories: [] } },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockIsOnline = true;
  mockCachedCategories = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useCategoryAutocomplete', () => {
  it('returns empty displayItems initially', () => {
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete());

    expect(result.current.displayItems).toEqual([]);
  });

  it('returns empty searchTerm initially', () => {
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete());

    expect(result.current.searchTerm).toBe('');
  });

  it('updates searchTerm via handleSearchTermChange', () => {
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('dairy');
    });

    expect(result.current.searchTerm).toBe('dairy');
  });

  it('triggers lazy query after debounce when term meets minChars', () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete(), {
      operationMocks: [createMock(recorded)],
    });

    act(() => {
      result.current.handleSearchTermChange('da');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(recorded).toContainEqual({
      input: { query: 'da', limit: 5, type: 'GENERAL' },
    });
  });

  it('uses custom categoryType when provided', () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () => useCategoryAutocomplete({ categoryType: CategoryType.Cuisine }),
      { operationMocks: [createMock(recorded)] },
    );

    act(() => {
      result.current.handleSearchTermChange('ital');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(recorded).toContainEqual({
      input: { query: 'ital', limit: 5, type: 'CUISINE' },
    });
  });

  it('does not trigger search when term is below minChars', () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete(), {
      operationMocks: [createMock(recorded)],
    });

    act(() => {
      result.current.handleSearchTermChange('d');
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(recorded).toEqual([]);
  });

  it('sets shouldSearch to true when searchTerm meets minChars and is online', () => {
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('ab');
    });

    expect(result.current.shouldSearch).toBe(true);
  });

  it('sets shouldSearch to false when offline', () => {
    mockIsOnline = false;
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('dairy');
    });

    expect(result.current.shouldSearch).toBe(false);
  });

  it('serves matches from the warmed cache offline without firing the API', () => {
    mockIsOnline = false;
    mockCachedCategories = [
      {
        __typename: 'CategorySuggestion',
        id: 'c1',
        name: 'Dairy',
        type: CategoryType.General,
        icon: null,
        color: null,
        slug: 'dairy',
      },
      {
        __typename: 'CategorySuggestion',
        id: 'c2',
        name: 'Produce',
        type: CategoryType.General,
        icon: null,
        color: null,
        slug: 'produce',
      },
    ];
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete(), {
      operationMocks: [createMock(recorded)],
    });

    act(() => {
      result.current.handleSearchTermChange('dair');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.displayItems.map(c => c.name)).toEqual(['Dairy']);
    expect(recorded).toEqual([]);
  });

  it('resets state when reset is called', () => {
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete());

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
    const { result } = renderHookWithApollo(() => useCategoryAutocomplete());

    expect(result.current.isLoading).toBe(false);
  });
});
