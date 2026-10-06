import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApolloClient, ApolloLink, Observable } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createOfflineModeLink } from '#/apollo/links/offlineModeLink';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { CreateItemDocument } from '#operations/item/item.generated';
import { ItemByLookupDocument } from '../useSearchResults.generated';
import { useSearchResults } from '../useSearchResults';
import { useStore } from '#store';
import { t } from '#/i18n';
import { TimeoutError } from '#/utils/errors/timeoutError';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import { alertService } from '#/services/alertService';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { isRecord } from '#/utils/isRecord';

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
const mockClearSearch = jest.fn();
const mockShowBottomSheet = jest.fn();
const mockHideBottomSheet = jest.fn();

jest.mock('#features/barcode/store/barcodeScannerStore', () => ({
  useSearchState: jest.fn(() => ({
    searchResults: [],
    setSearchResults: mockSetSearchResults,
    setSearching: mockSetSearching,
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
        if (typeof onError === 'function') await onError(e);
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

// One document serves both lookups, told apart by `lookup`.
const byUpc = { match: (vars: Record<string, unknown>) => isUpcLookup(vars) };
const bySku = { match: (vars: Record<string, unknown>) => !isUpcLookup(vars) };
function isUpcLookup(vars: Record<string, unknown>): boolean {
  return isRecord(vars.lookup) && 'upc' in vars.lookup;
}

function upcMock(items: MockItemNode[], options: { partial?: boolean } = {}) {
  const data: MockDataFor<typeof ItemByLookupDocument> = {
    items: {
      __typename: 'ItemConnection',
      edges: items.map((node, i) => ({
        __typename: 'ItemEdge',
        cursor: `c${i}`,
        node: { __typename: 'Item', ...node },
      })),
    },
  };
  return recordMock(ItemByLookupDocument, {
    ...byUpc,
    data,
    partial: options.partial,
  });
}

function skuMock(items: MockItemNode[]): MockedResponse {
  const data: MockDataFor<typeof ItemByLookupDocument> = {
    items: {
      __typename: 'ItemConnection',
      edges: items.map((node, i) => ({
        __typename: 'ItemEdge',
        cursor: `c${i}`,
        node: { __typename: 'Item', ...node },
      })),
    },
  };
  return recordMock(ItemByLookupDocument, {
    ...bySku,
    data,
  }).mock;
}

function upcErrorMock(
  error: Error,
  options: { maxUsageCount?: number } = {},
): MockedResponse {
  return recordMock(ItemByLookupDocument, {
    ...byUpc,
    error,
    maxUsageCount: options.maxUsageCount,
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
    __typename: 'Unit',
    id: 'unit-1',
    name: 'grams',
    symbol: 'g',
  },
  units: [{ __typename: 'ItemUnit', unitId: 'unit-1', isDefault: true }],
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
        operationMocks: [upcMock([SAMPLE_UPC_ITEM]).mock],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ id: 'item-1', name: 'Test Product' }),
          ]),
        ),
      );
      expect(mockHideBottomSheet).toHaveBeenCalled();
    });

    // The API matches every spelling of one code (UPC-A, EAN-13 with a leading
    // zero, GTIN-14, UPC-E), so the lookup sends exactly what the camera read;
    // a format it does not name is left for the API to detect.
    it.each([
      ['0012345678905', 'ean-13', 'EAN_13'],
      ['012345678905', 'upc-a', 'UPC_A'],
      ['012345678905', 'unknown-format', undefined],
    ])(
      'looks up %s (%s) as scanned and shows the product',
      async (code, format, upcFormat) => {
        const upc = upcMock([
          { ...SAMPLE_UPC_ITEM, primaryUpc: '012345678905' },
        ]);

        renderHookWithApollo(() => useSearchResults(code, format), {
          operationMocks: [upc.mock],
        });

        await waitFor(() =>
          expect(upc.fired).toContainEqual(
            expect.objectContaining({
              lookup: { upc: { code, format: upcFormat } },
            }),
          ),
        );
        await waitFor(() =>
          expect(mockSetSearchResults).toHaveBeenCalledWith(
            expect.arrayContaining([expect.objectContaining({ id: 'item-1' })]),
          ),
        );
      },
    );

    it("carries where the scanned pack's facts came from", async () => {
      renderHookWithApollo(() => useSearchResults('0012345678905', 'ean-13'), {
        operationMocks: [
          upcMock([
            {
              ...SAMPLE_UPC_ITEM,
              matchedVariation: {
                __typename: 'ProductVariation',
                id: 'off-1',
                upc: '0012345678905',
                source: 'OPENFOODFACTS',
              },
            },
          ]).mock,
        ],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith([
          expect.objectContaining({
            variationId: 'off-1',
            source: 'OPENFOODFACTS',
          }),
        ]),
      );
    });

    // `imageUrl` is the primary photo's thumbnail, which an edit form starts
    // from; the card's full-width image is the photo's original, with its credit.
    it('carries the photo the card shows, with its credit', async () => {
      const credit = {
        text: 'Open Food Facts',
        license: 'CC BY-SA 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
        sourceUrl: 'https://world.openfoodfacts.org/product/0012345678905',
      };
      renderHookWithApollo(() => useSearchResults('0012345678905', 'ean-13'), {
        operationMocks: [
          upcMock([
            {
              ...SAMPLE_UPC_ITEM,
              photos: [
                {
                  __typename: 'ItemPhoto',
                  id: 'photo-front',
                  url: 'https://cdn.test/front.jpg',
                  credit,
                },
              ],
            },
          ]).mock,
        ],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith([
          expect.objectContaining({
            imageUrl: SAMPLE_UPC_ITEM.imageUrl,
            image: {
              url: 'https://cdn.test/front.jpg',
              credit: expect.objectContaining(credit),
            },
          }),
        ]),
      );
    });

    it('shows an item with no photos by its only image and credit', async () => {
      const imageCredit = {
        __typename: 'ImageCredit',
        text: 'Open Food Facts',
        license: 'CC BY-SA 3.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
        sourceUrl: 'https://world.openfoodfacts.org/product/0012345678905',
      };
      renderHookWithApollo(() => useSearchResults('0012345678905', 'ean-13'), {
        operationMocks: [
          upcMock([{ ...SAMPLE_UPC_ITEM, photos: [], imageCredit }]).mock,
        ],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith([
          expect.objectContaining({
            image: { url: SAMPLE_UPC_ITEM.imageUrl, credit: imageCredit },
          }),
        ]),
      );
    });

    it('carries the notices the item data asks for', async () => {
      const notice = {
        __typename: 'DataAttribution',
        source: 'OPENFOODFACTS',
        notice: 'Product data from Open Food Facts, available under the ODbL.',
        licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
        sourceUrl: 'https://world.openfoodfacts.org/product/0012345678905',
      };
      renderHookWithApollo(() => useSearchResults('0012345678905', 'ean-13'), {
        operationMocks: [
          upcMock([{ ...SAMPLE_UPC_ITEM, dataAttributions: [notice] }]).mock,
        ],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith([
          expect.objectContaining({ dataAttributions: [notice] }),
        ]),
      );
    });

    // Both flags carry through to the card, which hides its edit action when
    // they are explicitly false — a scan can surface an item the user may not
    // touch. Absent is not false: the card only hides on a definite no.
    it('carries the write-path flags through to the scanned item', async () => {
      renderHookWithApollo(() => useSearchResults('1234567890', 'ean-13'), {
        operationMocks: [
          upcMock([{ ...SAMPLE_UPC_ITEM, canEdit: false, canSuggest: false }])
            .mock,
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
        operationMocks: [
          upcMock([{ ...SAMPLE_UPC_ITEM, categories: [] }], { partial: true })
            .mock,
        ],
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
        units: [],
        variationBrand: null,
        matchedVariation: null,
      };

      renderHookWithApollo(() => useSearchResults('SKU123'), {
        operationMocks: [upcMock([]).mock, skuMock([skuItem])],
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

    // A barcode names one pack of the item. What the scan shows, and what an
    // add stores, is that pack's own size and brand — never another pack's
    // figure or one brand picked from the item's list.
    it("reports the scanned barcode's own pack", async () => {
      renderHookWithApollo(() => useSearchResults('0001112223334', 'ean-13'), {
        operationMocks: [
          upcMock([
            {
              ...SAMPLE_UPC_ITEM,
              primaryUpc: '9998887776665',
              netWeight: 30,
              netWeightKind: 'SERVING',
              variationBrand: {
                __typename: 'Brand',
                id: 'brand-pack',
                name: 'Pack Brand',
              },
              matchedVariation: {
                __typename: 'ProductVariation',
                id: 'esm-1',
                upc: '0001112223334',
              },
              trackingUnit: {
                __typename: 'Unit',
                id: 'unit-can',
                name: 'can',
                symbol: 'can',
                type: 'COUNT',
                displayAsFraction: false,
              },
            },
          ]).mock,
        ],
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith([
          expect.objectContaining({
            upc: '0001112223334',
            variationId: 'esm-1',
            netWeight: 30,
            netWeightKind: 'SERVING',
            brandId: 'brand-pack',
            brandName: 'Pack Brand',
            trackingUnit: { id: 'unit-can', name: 'can', symbol: 'can' },
          }),
        ]),
      );
    });

    it('asks for the unit the destination pantry counts the item in', async () => {
      const upc = recordMock(ItemByLookupDocument, {
        ...byUpc,
        data: { items: { __typename: 'ItemConnection', edges: [] } },
      });

      renderHookWithApollo(
        () => useSearchResults('1234567890', 'ean-13', 'pantry-7'),
        { operationMocks: [upc.mock] },
      );

      await waitFor(() =>
        expect(upc.fired).toContainEqual({
          lookup: { upc: { code: '1234567890', format: 'EAN_13' } },
          pantry: 'pantry-7',
        }),
      );
    });

    it('shows bottom sheet when neither UPC nor SKU finds results', async () => {
      renderHookWithApollo(() => useSearchResults('UNKNOWN'), {
        operationMocks: [upcMock([]).mock, skuMock([])],
      });

      await waitFor(() => expect(mockShowBottomSheet).toHaveBeenCalledWith(1));
    });
  });

  describe('error mapping', () => {
    it('shows the connection copy for a failed fetch', async () => {
      renderHookWithApollo(() => useSearchResults('1234567890'), {
        operationMocks: [
          upcErrorMock(new NetworkRequestError('Network request failed')),
        ],
      });

      await waitFor(() =>
        expect(mockSetSearchError).toHaveBeenCalledWith(
          t('errors.networkError'),
        ),
      );
    });

    it('shows the connection copy for a request timeout', async () => {
      renderHookWithApollo(() => useSearchResults('1234567890'), {
        operationMocks: [
          upcErrorMock(
            new TimeoutError('Request timeout after 10000ms', 10000),
          ),
        ],
      });

      await waitFor(() =>
        expect(mockSetSearchError).toHaveBeenCalledWith(
          t('errors.networkError'),
        ),
      );
    });

    it('keeps the new-item form closed when the lookup fails', async () => {
      // The SKU lookup would answer, with nothing: it must not be asked.
      const sku = recordMock(ItemByLookupDocument, {
        ...bySku,
        data: { items: { __typename: 'ItemConnection', edges: [] } },
      });
      renderHookWithApollo(() => useSearchResults('1234567890'), {
        operationMocks: [
          upcErrorMock(new NetworkRequestError('Network request failed')),
          sku.mock,
        ],
      });

      await waitFor(() =>
        expect(mockSetSearchError).toHaveBeenCalledWith(
          t('errors.networkError'),
        ),
      );
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });
      // Offline is not "unknown": the product may exist, so nothing offers
      // to create it.
      expect(sku.fired).toEqual([]);
      expect(mockShowBottomSheet).not.toHaveBeenCalled();
    });

    describe('while offline', () => {
      const online = useStore.getState();
      afterEach(() => {
        useStore.setState({
          isOnline: online.isOnline,
          apiReachable: online.apiReachable,
        });
      });

      // The real `offlineModeLink` in front of a network that records calls.
      function renderOffline() {
        useStore.setState({ isOnline: false, apiReachable: null });
        const network = jest.fn(
          () =>
            new Observable<ApolloLink.Result>(observer => {
              observer.complete();
            }),
        );
        const client = new ApolloClient({
          cache: makeCache(),
          link: ApolloLink.from([
            createOfflineModeLink(),
            new ApolloLink(network),
          ]),
          defaultOptions: APOLLO_DEFAULT_OPTIONS,
        });
        renderHook(() => useSearchResults('1234567890'), {
          wrapper: ({ children }: { children: ReactNode }) =>
            createElement(ApolloProvider, { client, children }),
        });
        return network;
      }

      it('shows the connection copy, not a miss, and asks nobody', async () => {
        const network = renderOffline();

        await waitFor(() =>
          expect(mockSetSearchError).toHaveBeenCalledWith(
            t('errors.networkError'),
          ),
        );
        expect(network).not.toHaveBeenCalled();
        expect(mockShowBottomSheet).not.toHaveBeenCalled();
      });

      it('keeps the connection copy when the connection comes back', async () => {
        renderOffline();
        await waitFor(() =>
          expect(mockSetSearchError).toHaveBeenCalledWith(
            t('errors.networkError'),
          ),
        );

        act(() => {
          useStore.setState({ isOnline: true, apiReachable: true });
        });

        expect(mockSetSearchError).not.toHaveBeenCalledWith(
          t('errors.codes.genericRetry'),
        );
      });
    });

    it("shows the app's retry copy for a server failure, never its message", async () => {
      renderHookWithApollo(() => useSearchResults('1234567890'), {
        operationMocks: [upcErrorMock(new Error('Server error'))],
      });

      await waitFor(() =>
        expect(mockSetSearchError).toHaveBeenCalledWith(
          t('errors.codes.genericRetry'),
        ),
      );
      for (const [copy] of mockSetSearchError.mock.calls) {
        expect(copy ?? '').not.toContain('Server error');
      }
    });
  });

  describe('retry', () => {
    it('refetches the failed UPC query and shows its result', async () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        {
          operationMocks: [
            upcErrorMock(new Error('Server error'), { maxUsageCount: 1 }),
            upcMock([SAMPLE_UPC_ITEM]).mock,
          ],
        },
      );

      await waitFor(() =>
        expect(mockSetSearchError).toHaveBeenCalledWith(
          t('errors.codes.genericRetry'),
        ),
      );

      act(() => {
        result.current.handleRetry();
      });

      await waitFor(() =>
        expect(mockSetSearchResults).toHaveBeenCalledWith([
          expect.objectContaining({ id: 'item-1' }),
        ]),
      );
    });
  });

  describe('handleAddItem', () => {
    function createItemMock(): MockedResponse {
      return recordMock(CreateItemDocument, {
        data: {
          createItem: {
            __typename: 'CreateItemPayload',
            item: { __typename: 'Item', id: 'new-item' },
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

    it('hands an invalid barcode back to the form, not an alert', async () => {
      const refused = recordMock(CreateItemDocument, {
        data: {
          createItem: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'invalid GTIN',
            field: 'productDetails.primaryUpc',
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        { operationMocks: [refused.mock] },
      );

      let refusal: unknown;
      await act(async () => {
        refusal = await result.current.handleAddItem({
          name: 'New Item',
          upc: '012345678901',
        });
      });

      expect(refusal).toEqual({
        field: 'upc',
        message: t('errors.field.primaryUpc'),
      });
      expect(alertService.alert).not.toHaveBeenCalled();
    });

    it('alerts any other refusal, with nothing for the form to show', async () => {
      const refused = recordMock(CreateItemDocument, {
        data: {
          createItem: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            message: 'bad',
            field: 'name',
          },
        },
      });
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        { operationMocks: [refused.mock] },
      );

      let refusal: unknown = 'unset';
      await act(async () => {
        refusal = await result.current.handleAddItem({ name: 'New Item' });
      });

      expect(refusal).toBeUndefined();
      expect(alertService.alert).toHaveBeenCalledTimes(1);
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
