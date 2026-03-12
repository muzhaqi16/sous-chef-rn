import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { useSearchResults } from '../useSearchResults';

jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

const mockSetSearchResults = jest.fn();
const mockSetSearching = jest.fn();
const mockSetSearchError = jest.fn();
const mockAddToRecentlyScanned = jest.fn();
const mockClearSearch = jest.fn();
const mockShowBottomSheet = jest.fn();
const mockHideBottomSheet = jest.fn();
const mockCreateItemMutation = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({
      searchResults: [],
      setSearchResults: mockSetSearchResults,
      setSearching: mockSetSearching,
      addToRecentlyScanned: mockAddToRecentlyScanned,
      clearSearch: mockClearSearch,
      setSearchError: mockSetSearchError,
      showBottomSheet: mockShowBottomSheet,
      hideBottomSheet: mockHideBottomSheet,
    }),
  selectSearchState: (s: any) => ({
    searchResults: s.searchResults,
    setSearchResults: s.setSearchResults,
    setSearching: s.setSearching,
    addToRecentlyScanned: s.addToRecentlyScanned,
    clearSearch: s.clearSearch,
    setSearchError: s.setSearchError,
  }),
  selectBottomSheetState: (s: any) => ({
    showBottomSheet: s.showBottomSheet,
    hideBottomSheet: s.hideBottomSheet,
  }),
}));

jest.mock('zustand/shallow', () => ({
  useShallow: (fn: any) => fn,
}));

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useItemByUpcFilterQuery: jest.fn(() => ({
    data: undefined,
    loading: true,
    error: undefined,
  })),
  useItemBySkuFilterQuery: jest.fn(() => ({
    data: undefined,
    loading: false,
    error: undefined,
  })),
  useCreateItemMutation: jest.fn(() => [
    mockCreateItemMutation,
    { loading: false },
  ]),
  useFlagItemForReviewMutation: jest.fn(() => [jest.fn(), { loading: false }]),
}));

jest.mock('../useImageUpload', () => ({
  useImageUpload: jest.fn(() => ({
    uploadItemImage: jest.fn(),
  })),
}));

jest.mock('#/storage/mmkv', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('#/utils/compilerSafeWrappers');

// Break circular dependency
jest.mock('../../apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSearchResults', () => {
  it('clears previous search results on barcode change', () => {
    renderHook(() => useSearchResults('1234567890', 'ean-13'));

    expect(mockSetSearchResults).toHaveBeenCalledWith([]);
    expect(mockSetSearchError).toHaveBeenCalledWith(null);
    expect(mockSetSearching).toHaveBeenCalledWith(true);
  });

  it('returns loading true when UPC query is loading', () => {
    const { result } = renderHook(() => useSearchResults('1234567890'));

    expect(result.current.loading).toBe(true);
  });

  it('returns search results from store', () => {
    const { result } = renderHook(() => useSearchResults('1234567890'));

    expect(result.current.searchResults).toEqual([]);
  });

  it('exposes clearSearch', () => {
    const { result } = renderHook(() => useSearchResults('1234567890'));

    expect(result.current.clearSearch).toBe(mockClearSearch);
  });

  it('exposes handleRetry', () => {
    const { result } = renderHook(() => useSearchResults('1234567890'));

    expect(typeof result.current.handleRetry).toBe('function');
  });

  it('handleRetry clears search error', () => {
    const { result } = renderHook(() => useSearchResults('1234567890'));

    result.current.handleRetry();

    expect(mockSetSearchError).toHaveBeenCalledWith(null);
  });

  it('exposes addingItem state', () => {
    const { result } = renderHook(() => useSearchResults('1234567890'));

    expect(result.current.addingItem).toBe(false);
  });

  it('sets search results when UPC query finds an item', () => {
    const { useItemByUpcFilterQuery } = require('#generated');
    useItemByUpcFilterQuery.mockReturnValue({
      data: {
        items: {
          edges: [
            {
              node: {
                id: 'item-1',
                name: 'Test Product',
                description: 'A test product',
                imageUrl: 'http://img.com/1.jpg',
                primaryUpc: '1234567890',
                netWeight: 500,
                displayUnit: { id: 'unit-1', name: 'grams', symbol: 'g' },
                brands: [{ brand: { id: 'brand-1', name: 'TestBrand' } }],
                units: [{ unitId: 'unit-1', isDefault: true }],
                variationBrand: null,
                matchedVariation: null,
              },
            },
          ],
        },
      },
      loading: false,
      error: undefined,
    });

    renderHook(() => useSearchResults('1234567890', 'ean-13'));

    expect(mockSetSearching).toHaveBeenCalledWith(false);
    expect(mockSetSearchResults).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'item-1', name: 'Test Product' }),
      ]),
    );
    expect(mockAddToRecentlyScanned).toHaveBeenCalled();
    expect(mockHideBottomSheet).toHaveBeenCalled();
  });

  it('falls back to SKU query when UPC finds nothing', () => {
    const {
      useItemByUpcFilterQuery,
      useItemBySkuFilterQuery,
    } = require('#generated');
    useItemByUpcFilterQuery.mockReturnValue({
      data: { items: { edges: [] } },
      loading: false,
      error: undefined,
    });
    useItemBySkuFilterQuery.mockReturnValue({
      data: {
        items: {
          edges: [
            {
              node: {
                id: 'item-sku',
                name: 'SKU Product',
                description: null,
                imageUrl: null,
                primaryUpc: null,
                netWeight: null,
                displayUnit: null,
                brands: [],
                units: [],
                variationBrand: null,
                matchedVariation: null,
              },
            },
          ],
        },
      },
      loading: false,
      error: undefined,
    });

    renderHook(() => useSearchResults('SKU123'));

    expect(mockSetSearchResults).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'item-sku', name: 'SKU Product' }),
      ]),
    );
    expect(mockHideBottomSheet).toHaveBeenCalled();
  });

  it('shows bottom sheet when neither UPC nor SKU finds results', () => {
    const {
      useItemByUpcFilterQuery,
      useItemBySkuFilterQuery,
    } = require('#generated');
    useItemByUpcFilterQuery.mockReturnValue({
      data: { items: { edges: [] } },
      loading: false,
      error: undefined,
    });
    useItemBySkuFilterQuery.mockReturnValue({
      data: { items: { edges: [] } },
      loading: false,
      error: undefined,
    });

    renderHook(() => useSearchResults('UNKNOWN'));

    expect(mockSetSearchResults).toHaveBeenCalledWith([]);
    expect(mockShowBottomSheet).toHaveBeenCalledWith(1);
  });

  it('handles timeout error from UPC query', () => {
    const { useItemByUpcFilterQuery } = require('#generated');
    useItemByUpcFilterQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { message: 'Request timeout', networkError: null },
    });

    renderHook(() => useSearchResults('1234567890'));

    expect(mockSetSearching).toHaveBeenCalledWith(false);
    expect(mockSetSearchError).toHaveBeenCalledWith(
      'Search timed out. Please try again.',
    );
  });

  it('handles network error from queries', () => {
    const { useItemByUpcFilterQuery } = require('#generated');
    useItemByUpcFilterQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { message: 'Network error', networkError: new Error('net') },
    });

    renderHook(() => useSearchResults('1234567890'));

    expect(mockSetSearchError).toHaveBeenCalledWith(
      'Unable to search. Please check your connection and try again.',
    );
  });

  it('handles generic query error', () => {
    const { useItemByUpcFilterQuery } = require('#generated');
    useItemByUpcFilterQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: { message: 'Server error' },
    });

    renderHook(() => useSearchResults('1234567890'));

    expect(mockSetSearchError).toHaveBeenCalledWith(
      'Search failed: Server error',
    );
  });

  it('maps ean-13 format correctly', () => {
    const { useItemByUpcFilterQuery } = require('#generated');
    renderHook(() => useSearchResults('1234567890', 'ean-13'));

    expect(useItemByUpcFilterQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { upc: '1234567890', upcFormat: 'EAN_13' },
      }),
    );
  });

  it('maps upc-a format correctly', () => {
    const { useItemByUpcFilterQuery } = require('#generated');
    renderHook(() => useSearchResults('1234567890', 'upc-a'));

    expect(useItemByUpcFilterQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { upc: '1234567890', upcFormat: 'UPC_A' },
      }),
    );
  });

  it('passes undefined for unknown format', () => {
    const { useItemByUpcFilterQuery } = require('#generated');
    renderHook(() => useSearchResults('1234567890', 'unknown-format'));

    expect(useItemByUpcFilterQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { upc: '1234567890', upcFormat: undefined },
      }),
    );
  });

  it('handleAddItem stores images and calls mutation', async () => {
    const { useItemByUpcFilterQuery } = require('#generated');
    const { storage } = require('#/storage/mmkv');
    useItemByUpcFilterQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
    });

    const { result } = renderHook(() => useSearchResults('1234567890'));

    await act(async () => {
      await result.current.handleAddItem({
        name: 'New Item',
        description: 'Test description',
        selectedImages: [{ uri: 'file://image.jpg' }],
        brand: { brandName: 'TestBrand' },
      });
    });

    expect(storage.set).toHaveBeenCalledWith(
      'temp_pending_item_images',
      expect.any(String),
    );
    expect(mockCreateItemMutation).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          name: 'New Item',
          description: 'Test description',
        }),
      },
    });
  });

  it('handleAddItem uses singular selectedImage for backward compat', async () => {
    const { useItemByUpcFilterQuery } = require('#generated');
    const { storage } = require('#/storage/mmkv');
    useItemByUpcFilterQuery.mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
    });

    const { result } = renderHook(() => useSearchResults('1234567890'));

    await act(async () => {
      await result.current.handleAddItem({
        name: 'New Item',
        selectedImage: { uri: 'file://single.jpg' },
      });
    });

    expect(storage.set).toHaveBeenCalledWith(
      'temp_pending_item_image',
      expect.any(String),
    );
  });

  it('returns loading true when SKU query is loading', () => {
    const {
      useItemByUpcFilterQuery,
      useItemBySkuFilterQuery,
    } = require('#generated');
    useItemByUpcFilterQuery.mockReturnValue({
      data: { items: { edges: [] } },
      loading: false,
      error: undefined,
    });
    useItemBySkuFilterQuery.mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
    });

    const { result } = renderHook(() => useSearchResults('1234567890'));

    expect(result.current.loading).toBe(true);
  });
});
