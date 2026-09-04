import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  ItemByUpcFilterDocument,
  ItemBySkuFilterDocument,
  CreateItemDocument,
} from '#operations/item/item.generated';
import { useSearchResults } from '../useSearchResults';
import { useStore } from '#store';

// Partial item-node shapes for mock connection edges. Kept as a loose record
// because the fixtures deliberately omit required Item fields (type,
// storageState, …) that the hook under test never reads.
type MockItemNode = Record<string, unknown>;

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const mockSetSearchResults = jest.fn();
const mockSetSearching = jest.fn();
const mockSetSearchError = jest.fn();
const mockAddToRecentlyScanned = jest.fn();
const mockClearSearch = jest.fn();
const mockShowBottomSheet = jest.fn();
const mockHideBottomSheet = jest.fn();

jest.mock('#features/barcode/store/barcodeScannerStore', () => ({
  useSearchState: jest.fn(() => ({
    searchResults: [],
    setSearchResults: mockSetSearchResults,
    setSearching: mockSetSearching,
    addToRecentlyScanned: mockAddToRecentlyScanned,
    clearSearch: mockClearSearch,
    setSearchError: mockSetSearchError,
  })),
  useBottomSheetState: jest.fn(() => ({
    showBottomSheet: mockShowBottomSheet,
    hideBottomSheet: mockHideBottomSheet,
  })),
}));

const mockUploadItemImages = jest.fn(async () => []);
jest.mock('#hooks/useImageUpload', () => ({
  useImageUpload: jest.fn(() => ({
    uploadItemImage: jest.fn(),
    uploadItemImages: mockUploadItemImages,
  })),
}));

jest.mock('#/storage/mmkv');

jest.mock('#/utils/finallyHelpers', () => ({
  executeMutation: jest.fn(
    async <T>(
      fn: () => Promise<T>,
      onError: string | ((error: unknown) => void | Promise<void>),
    ) => {
      try {
        await fn();
        return true;
      } catch (e) {
        if (typeof onError === 'function') onError(e);
        return false;
      }
    },
  ),
}));

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

// --- Mock builders ---

function upcMock(
  items: MockItemNode[],
  options: { partial?: boolean } = {},
): MockedResponse {
  return recordMock(ItemByUpcFilterDocument, {
    data: {
      items: {
        __typename: 'ItemConnection' as const,
        edges: items.map((node, i) => ({
          __typename: 'ItemEdge' as const,
          cursor: `c${i}`,
          node: { __typename: 'Item' as const, ...node },
        })),
      },
    },
    partial: options.partial,
  }).mock;
}

function skuMock(items: MockItemNode[]): MockedResponse {
  return recordMock(ItemBySkuFilterDocument, {
    data: {
      items: {
        __typename: 'ItemConnection' as const,
        edges: items.map((node, i) => ({
          __typename: 'ItemEdge' as const,
          cursor: `c${i}`,
          node: { __typename: 'Item' as const, ...node },
        })),
      },
    },
  }).mock;
}

function upcErrorMock(message: string): MockedResponse {
  return recordMock(ItemByUpcFilterDocument, {
    error: new Error(message),
  }).mock;
}

const SAMPLE_UPC_ITEM = {
  id: 'item-1',
  name: 'Test Product',
  description: 'A test product',
  imageUrl: 'http://img.com/1.jpg',
  primaryUpc: '1234567890',
  netWeight: 500,
  displayUnit: {
    __typename: 'Unit' as const,
    id: 'unit-1',
    name: 'grams',
    symbol: 'g',
  },
  brands: [
    {
      __typename: 'ItemBrand' as const,
      brand: { __typename: 'Brand' as const, id: 'brand-1', name: 'TestBrand' },
    },
  ],
  units: [
    { __typename: 'ItemUnit' as const, unitId: 'unit-1', isDefault: true },
  ],
  variationBrand: null,
  matchedVariation: null,
};

describe('useSearchResults', () => {
  describe('initial state and store wiring', () => {
    it('clears previous search results on barcode change', () => {
      renderHookWithApollo(() => useSearchResults('1234567890', 'ean-13'));

      expect(mockSetSearchResults).toHaveBeenCalledWith([]);
      expect(mockSetSearchError).toHaveBeenCalledWith(null);
      expect(mockSetSearching).toHaveBeenCalledWith(true);
    });

    it('returns search results from store', () => {
      const { result } = renderHookWithApollo(() =>
        useSearchResults('1234567890'),
      );

      expect(result.current.searchResults).toEqual([]);
    });

    it('exposes clearSearch', () => {
      const { result } = renderHookWithApollo(() =>
        useSearchResults('1234567890'),
      );

      expect(result.current.clearSearch).toBe(mockClearSearch);
    });

    it('exposes handleRetry that clears search error', () => {
      const { result } = renderHookWithApollo(() =>
        useSearchResults('1234567890'),
      );

      result.current.handleRetry();

      expect(mockSetSearchError).toHaveBeenCalledWith(null);
    });

    it('exposes addingItem state', () => {
      const { result } = renderHookWithApollo(() =>
        useSearchResults('1234567890'),
      );

      expect(result.current.addingItem).toBe(false);
    });
  });

  describe('UPC query results', () => {
    it('sets search results when UPC query finds an item', async () => {
      renderHookWithApollo(() => useSearchResults('1234567890', 'ean-13'), {
        operationMocks: [upcMock([SAMPLE_UPC_ITEM])],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: 'item-1', name: 'Test Product' }),
          ]),
        ),
      );
      await waitFor(() => expect(mockAddToRecentlyScanned).toHaveBeenCalled());
      expect(mockHideBottomSheet).toHaveBeenCalled();
    });

    // Both flags carry through to the card, which hides its edit action when
    // they are explicitly false — a scan can surface an item the user may not
    // touch. Absent is not false: the card only hides on a definite no.
    it('carries the write-path flags through to the scanned item', async () => {
      renderHookWithApollo(() => useSearchResults('1234567890', 'ean-13'), {
        operationMocks: [
          upcMock([{ ...SAMPLE_UPC_ITEM, canEdit: false, canSuggest: false }]),
        ],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ canEdit: false, canSuggest: false }),
          ]),
        ),
      );
    });

    it('leaves the write-path flags undefined when the API omits them', async () => {
      renderHookWithApollo(() => useSearchResults('1234567890', 'ean-13'), {
        // The omission IS the subject: schema completion would supply the
        // flags this test asserts are absent. Marking THIS mock partial
        // excuses exactly the fields it leaves out — the old whole-test flag
        // switched the missing-field guard off for everything.
        operationMocks: [upcMock([SAMPLE_UPC_ITEM], { partial: true })],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              canEdit: undefined,
              canSuggest: undefined,
            }),
          ]),
        ),
      );
    });

    it('falls back to SKU query when UPC finds nothing', async () => {
      const skuItem = {
        id: 'item-sku',
        name: 'SKU Product',
        description: null,
        imageUrl: null,
        primaryUpc: null,
        netWeight: null,
        displayUnit: null,
        brands: [],
        units: [],
        // `variationBrand` / `matchedVariation` are selected by
        // `ItemByUpcFilter` only — the SKU query cannot return them.
      };

      renderHookWithApollo(() => useSearchResults('SKU123'), {
        operationMocks: [upcMock([]), skuMock([skuItem])],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: 'item-sku', name: 'SKU Product' }),
          ]),
        ),
      );
      expect(mockHideBottomSheet).toHaveBeenCalled();
    });

    it('shows bottom sheet when neither UPC nor SKU finds results', async () => {
      renderHookWithApollo(() => useSearchResults('UNKNOWN'), {
        operationMocks: [upcMock([]), skuMock([])],
      });

      await waitFor(() => expect(mockShowBottomSheet).toHaveBeenCalledWith(1));
    });
  });

  describe('error mapping', () => {
    it('maps timeout to user-friendly message', async () => {
      renderHookWithApollo(() => useSearchResults('1234567890'), {
        operationMocks: [upcErrorMock('Request timeout')],
      });

      await waitFor(() =>
        expect(mockSetSearchError).toHaveBeenCalledWith(
          'Search timed out. Please try again.',
        ),
      );
    });

    it('maps generic errors via "Search failed:" prefix', async () => {
      renderHookWithApollo(() => useSearchResults('1234567890'), {
        operationMocks: [upcErrorMock('Server error')],
      });

      await waitFor(() =>
        expect(mockSetSearchError).toHaveBeenCalledWith(
          expect.stringContaining('Server error'),
        ),
      );
    });
  });

  describe('format mapping', () => {
    it('maps ean-13 → EAN_13 and fires UPC query with that variable', async () => {
      const upc = recordMock(ItemByUpcFilterDocument, {
        data: { items: { __typename: 'ItemConnection' as const, edges: [] } },
      });

      renderHookWithApollo(() => useSearchResults('1234567890', 'ean-13'), {
        operationMocks: [upc.mock],
      });

      await waitFor(() =>
        expect(upc.fired).toContainEqual({
          upc: '1234567890',
          upcFormat: 'EAN_13',
        }),
      );
    });

    it('maps upc-a → UPC_A', async () => {
      const upc = recordMock(ItemByUpcFilterDocument, {
        data: { items: { __typename: 'ItemConnection' as const, edges: [] } },
      });

      renderHookWithApollo(() => useSearchResults('1234567890', 'upc-a'), {
        operationMocks: [upc.mock],
      });

      await waitFor(() =>
        expect(upc.fired).toContainEqual({
          upc: '1234567890',
          upcFormat: 'UPC_A',
        }),
      );
    });

    it('passes undefined upcFormat for unknown formats', async () => {
      const upc = recordMock(ItemByUpcFilterDocument, {
        data: { items: { __typename: 'ItemConnection' as const, edges: [] } },
      });

      renderHookWithApollo(
        () => useSearchResults('1234567890', 'unknown-format'),
        { operationMocks: [upc.mock] },
      );

      await waitFor(() =>
        expect(upc.fired).toContainEqual({
          upc: '1234567890',
          upcFormat: undefined,
        }),
      );
    });
  });

  describe('handleAddItem', () => {
    function createItemMock(): MockedResponse {
      return recordMock(CreateItemDocument, {
        data: {
          createItem: {
            __typename: 'CreateItemPayload' as const,
            item: { __typename: 'Item' as const, id: 'new-item' },
          },
        },
      }).mock;
    }

    it('stores plural images and calls CreateItem mutation', async () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        { operationMocks: [createItemMock()] },
      );

      await act(async () => {
        await result.current.handleAddItem({
          name: 'New Item',
          description: 'Test description',
          selectedImages: [{ uri: 'file://image.jpg' }],
          brand: { brandName: 'TestBrand' },
        });
      });

      // Held in the store until the create returns an id to attach them to,
      // then handed to the batch upload and cleared.
      expect(mockUploadItemImages).toHaveBeenCalledWith(
        [{ uri: 'file://image.jpg' }],
        expect.any(String),
      );
      expect(useStore.getState().pendingItemImages).toBeNull();
    });

    it('takes a singular selectedImage as a one-image batch', async () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        { operationMocks: [createItemMock()] },
      );

      await act(async () => {
        await result.current.handleAddItem({
          name: 'New Item',
          selectedImage: { uri: 'file://single.jpg' },
        });
      });

      expect(mockUploadItemImages).toHaveBeenCalledWith(
        [{ uri: 'file://single.jpg' }],
        expect.any(String),
      );
    });
  });
});
