import { createElement, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApolloClient, ApolloLink, Observable } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createOfflineModeLink } from '#/apollo/links/offlineModeLink';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
  type MockPart,
} from '#/test-utils/apolloMockProvider';
import { connectionOf } from '#/test-utils/fixtures/connectionOf';
import { CreateItemDocument } from '#operations/item/item.generated';
import {
  ItemByLookupDocument,
  type ItemByLookupQuery,
} from '../useSearchResults.generated';
import { useSearchResults } from '../useSearchResults';
import { useStore } from '#store';
import { t, type TranslationKey } from '#/i18n';
import { TimeoutError } from '#/utils/errors/timeoutError';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import { alertService } from '#/services/alertService';
import {
  ErrorCode,
  ExternalSource,
  NetWeightKind,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { isRecord } from '#/utils/isRecord';

type LookupNode = MockPart<ItemByLookupQuery['items']['edges'][number]['node']>;

const mockShowBottomSheet = jest.fn();
const mockHideBottomSheet = jest.fn();

jest.mock('#features/barcode/store/barcodeScannerStore', () => ({
  useBottomSheetState: jest.fn(() => ({
    showBottomSheet: mockShowBottomSheet,
    hideBottomSheet: mockHideBottomSheet,
  })),
}));

const mockUploadItemImages = jest.fn(
  async (): Promise<Array<{ imageUrl: string }>> => [],
);
jest.mock('#hooks/data/useImageUpload', () => ({
  useImageUpload: jest.fn(() => ({
    uploadItemImage: jest.fn(),
    uploadItemImages: mockUploadItemImages,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

/**
 * One lookup's answer: the items it finds, or the error it fails with. One
 * document serves both lookups, told apart by `lookup`.
 */
function lookupMock(
  by: 'upc' | 'sku',
  answer: LookupNode[] | Error,
  options: { held?: boolean; maxUsageCount?: number } = {},
) {
  return recordMock(ItemByLookupDocument, {
    match: vars =>
      (isRecord(vars.lookup) && 'upc' in vars.lookup) === (by === 'upc'),
    ...(answer instanceof Error
      ? { error: answer }
      : { data: { items: connectionOf(answer) } }),
    ...options,
  });
}

const SAMPLE_UPC_ITEM = {
  id: 'item-1',
  name: 'Test Product',
  imageUrl: 'http://img.com/1.jpg',
  variationBrand: null,
  matchedVariation: null,
} satisfies LookupNode;

describe('useSearchResults', () => {
  describe('before the lookups answer', () => {
    it('is loading, with no item and no error', () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890', 'ean-13'),
        { operationMocks: [] },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.item).toBeNull();
      expect(result.current.error).toBeNull();
    });

    // The sheet's visibility is the scanner store's, so an earlier scan can
    // leave it open; a new result screen starts with it closed.
    it('starts with the create sheet closed', () => {
      renderHookWithApollo(() => useSearchResults('1234567890'), {
        operationMocks: [],
      });

      expect(mockHideBottomSheet).toHaveBeenCalled();
      expect(mockShowBottomSheet).not.toHaveBeenCalled();
    });

    it('exposes addingItem state', () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        { operationMocks: [] },
      );

      expect(result.current.addingItem).toBe(false);
    });
  });

  describe('UPC query results', () => {
    it('shows the item the UPC lookup finds', async () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890', 'ean-13'),
        { operationMocks: [lookupMock('upc', [SAMPLE_UPC_ITEM]).mock] },
      );

      await waitFor(() =>
        expect(result.current.item).toEqual(
          expect.objectContaining({ id: 'item-1', name: 'Test Product' }),
        ),
      );
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockShowBottomSheet).not.toHaveBeenCalled();
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
        const upc = lookupMock('upc', [SAMPLE_UPC_ITEM]);

        const { result } = renderHookWithApollo(
          () => useSearchResults(code, format),
          { operationMocks: [upc.mock] },
        );

        await waitFor(() =>
          expect(upc.fired).toContainEqual(
            expect.objectContaining({
              lookup: { upc: { code, format: upcFormat } },
            }),
          ),
        );
        await waitFor(() =>
          expect(result.current.item).toEqual(
            expect.objectContaining({ id: 'item-1' }),
          ),
        );
      },
    );

    const credit = {
      __typename: 'ImageCredit',
      text: 'Open Food Facts',
      license: 'CC BY-SA 3.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
      sourceUrl: 'https://world.openfoodfacts.org/product/0001112223334',
    } satisfies LookupNode['imageCredit'];
    const notice = {
      __typename: 'DataAttribution',
      source: ExternalSource.Openfoodfacts,
      notice: 'Product data from Open Food Facts, available under the ODbL.',
      licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
      sourceUrl: 'https://world.openfoodfacts.org/product/0001112223334',
    } satisfies NonNullable<LookupNode['dataAttributions']>[number];

    it.each<[string, LookupNode, Record<string, unknown>]>([
      [
        "carries where the scanned pack's facts came from",
        {
          matchedVariation: {
            id: 'off-1',
            upc: '0001112223334',
            source: 'OPENFOODFACTS',
          },
        },
        { variationId: 'off-1', source: 'OPENFOODFACTS' },
      ],
      // `imageUrl` is the primary photo's thumbnail, which an edit form starts
      // from; the card's full-width image is the photo's original, with its credit.
      [
        'carries the photo the card shows, with its credit',
        {
          photos: [
            { id: 'photo-front', url: 'https://cdn.test/front.jpg', credit },
          ],
        },
        {
          imageUrl: SAMPLE_UPC_ITEM.imageUrl,
          image: { url: 'https://cdn.test/front.jpg', credit },
        },
      ],
      [
        'shows an item with no photos by its only image and credit',
        { photos: [], imageCredit: credit },
        { image: { url: SAMPLE_UPC_ITEM.imageUrl, credit } },
      ],
      [
        'carries the notices the item data asks for',
        { dataAttributions: [notice] },
        { dataAttributions: [notice] },
      ],
      // Both flags carry through to the card, which hides its edit action when
      // both are false — a scan can surface an item the user may not touch.
      [
        'carries the write-path flags through to the scanned item',
        { canEdit: false, canSuggest: false },
        { canEdit: false, canSuggest: false },
      ],
      // A barcode names one pack of the item. What the scan shows, and what an
      // add stores, is that pack's own size and brand — never another pack's
      // figure or one brand picked from the item's list.
      [
        "reports the scanned barcode's own pack",
        {
          primaryUpc: '9998887776665',
          netWeight: 30,
          netWeightKind: NetWeightKind.Serving,
          variationBrand: { id: 'brand-pack', name: 'Pack Brand' },
          matchedVariation: { id: 'esm-1', upc: '0001112223334' },
          trackingUnit: {
            id: 'unit-can',
            name: 'can',
            symbol: 'can',
            type: UnitType.Count,
          },
        },
        {
          upc: '0001112223334',
          variationId: 'esm-1',
          netWeight: 30,
          netWeightKind: 'SERVING',
          brandId: 'brand-pack',
          brandName: 'Pack Brand',
          trackingUnit: {
            id: 'unit-can',
            name: 'can',
            symbol: 'can',
            type: UnitType.Count,
          },
        },
      ],
      [
        "reports the scanned pack's size as read in each unit system",
        {
          netWeight: 1360.78,
          netWeightKind: NetWeightKind.Package,
          packageSize: {
            __typename: 'Measure',
            value: 1360.78,
            unit: { __typename: 'Unit', id: 'unit-g' },
            metric: {
              __typename: 'MeasureReading',
              value: 1.36,
              unit: {
                __typename: 'Unit',
                id: 'unit-kg',
                symbol: 'kg',
                displayAsFraction: false,
                type: UnitType.Weight,
              },
            },
            imperial: {
              __typename: 'MeasureReading',
              value: 3,
              unit: {
                __typename: 'Unit',
                id: 'unit-lb',
                symbol: 'lb',
                displayAsFraction: false,
                type: UnitType.Weight,
              },
            },
            declared: null,
          },
        },
        {
          netWeight: 1360.78,
          packageSize: expect.objectContaining({
            imperial: expect.objectContaining({ value: 3 }),
            metric: expect.objectContaining({ value: 1.36 }),
          }),
        },
      ],
    ])('%s', async (_name, node, expected) => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('0001112223334', 'ean-13'),
        {
          operationMocks: [
            lookupMock('upc', [{ ...SAMPLE_UPC_ITEM, ...node }]).mock,
          ],
        },
      );

      await waitFor(() =>
        expect(result.current.item).toEqual(expect.objectContaining(expected)),
      );
    });

    it('falls back to SKU query when UPC finds nothing', async () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('SKU123'),
        {
          operationMocks: [
            lookupMock('upc', []).mock,
            lookupMock('sku', [{ id: 'item-sku', name: 'SKU Product' }]).mock,
          ],
        },
      );

      await waitFor(() =>
        expect(result.current.item).toEqual(
          expect.objectContaining({ id: 'item-sku', name: 'SKU Product' }),
        ),
      );
      expect(result.current.loading).toBe(false);
      expect(mockShowBottomSheet).not.toHaveBeenCalled();
    });

    it('asks for the unit the destination pantry counts the item in', async () => {
      const upc = lookupMock('upc', []);

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

    it('opens the create sheet when neither UPC nor SKU finds results', async () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('UNKNOWN'),
        {
          operationMocks: [
            lookupMock('upc', []).mock,
            lookupMock('sku', []).mock,
          ],
        },
      );

      await waitFor(() => expect(mockShowBottomSheet).toHaveBeenCalled());
      expect(result.current.item).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    // Between the UPC miss and the SKU answer nothing is known yet: neither an
    // empty result nor a miss may show.
    it('stays loading until the SKU lookup answers', async () => {
      const sku = lookupMock('sku', [], { held: true });
      const { result } = renderHookWithApollo(
        () => useSearchResults('UNKNOWN'),
        { operationMocks: [lookupMock('upc', []).mock, sku.mock] },
      );

      await waitFor(() => expect(sku.fired).toHaveLength(1));
      expect(result.current.loading).toBe(true);
      expect(mockShowBottomSheet).not.toHaveBeenCalled();

      await act(async () => sku.release());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(mockShowBottomSheet).toHaveBeenCalled();
    });
  });

  describe('error mapping', () => {
    it.each<[string, Error, TranslationKey]>([
      [
        'shows the connection copy for a failed fetch',
        new NetworkRequestError('Network request failed'),
        'errors.networkError',
      ],
      [
        'shows the connection copy for a request timeout',
        new TimeoutError('Request timeout after 10000ms', 10000),
        'errors.networkError',
      ],
      [
        "shows the app's retry copy for a server failure, never its message",
        new Error('Server error'),
        'errors.codes.genericRetry',
      ],
    ])('%s', async (_name, error, copy) => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        { operationMocks: [lookupMock('upc', error).mock] },
      );

      await waitFor(() => expect(result.current.error).toBe(t(copy)));
      expect(result.current.loading).toBe(false);
      expect(result.current.item).toBeNull();
    });

    it('keeps the new-item form closed when the lookup fails', async () => {
      // The SKU lookup would answer, with nothing: it must not be asked.
      const sku = lookupMock('sku', []);
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        {
          operationMocks: [
            lookupMock('upc', new NetworkRequestError('Network request failed'))
              .mock,
            sku.mock,
          ],
        },
      );

      await waitFor(() =>
        expect(result.current.error).toBe(t('errors.networkError')),
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
        const rendered = renderHook(() => useSearchResults('1234567890'), {
          wrapper: ({ children }: { children: ReactNode }) =>
            createElement(ApolloProvider, { client, children }),
        });
        return { network, ...rendered };
      }

      it('shows the connection copy, not a miss, and asks nobody', async () => {
        const { network, result } = renderOffline();

        await waitFor(() =>
          expect(result.current.error).toBe(t('errors.networkError')),
        );
        expect(network).not.toHaveBeenCalled();
        expect(mockShowBottomSheet).not.toHaveBeenCalled();
      });

      it('keeps the connection copy when the connection comes back', async () => {
        const { result, rerender } = renderOffline();
        await waitFor(() =>
          expect(result.current.error).toBe(t('errors.networkError')),
        );

        act(() => {
          useStore.setState({ isOnline: true, apiReachable: true });
        });
        rerender({});

        expect(result.current.error).toBe(t('errors.networkError'));
      });
    });
  });

  describe('retry', () => {
    it('refetches the failed UPC query and shows its result', async () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        {
          operationMocks: [
            lookupMock('upc', new Error('Server error'), { maxUsageCount: 1 })
              .mock,
            lookupMock('upc', [SAMPLE_UPC_ITEM]).mock,
          ],
        },
      );

      await waitFor(() =>
        expect(result.current.error).toBe(t('errors.codes.genericRetry')),
      );

      act(() => {
        result.current.handleRetry();
      });

      await waitFor(() =>
        expect(result.current.item).toEqual(
          expect.objectContaining({ id: 'item-1' }),
        ),
      );
      expect(result.current.error).toBeNull();
    });
  });

  describe('handleAddItem', () => {
    function createItemMock(
      item: Record<string, unknown> = {},
    ): MockedResponse {
      return recordMock(CreateItemDocument, {
        data: {
          createItem: {
            __typename: 'CreateItemPayload',
            item: { __typename: 'Item', id: 'new-item', ...item },
          },
        },
      }).mock;
    }

    /** A code neither lookup knows, so the form creates its item. */
    const missedLookups = () => [
      lookupMock('upc', []).mock,
      lookupMock('sku', []).mock,
    ];

    // Held in the store until the create returns an id to attach them to,
    // then handed to the batch upload and cleared.
    it.each([
      [
        'stores plural images and calls CreateItem mutation',
        { selectedImages: [{ uri: 'file://image.jpg' }] },
        [{ uri: 'file://image.jpg' }],
      ],
      [
        'takes a singular selectedImage as a one-image batch',
        { selectedImage: { uri: 'file://single.jpg' } },
        [{ uri: 'file://single.jpg' }],
      ],
    ])('%s', async (_name, images, uploaded) => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('1234567890'),
        { operationMocks: [createItemMock()] },
      );

      await act(async () => {
        await result.current.handleAddItem({ name: 'New Item', ...images });
      });

      expect(mockUploadItemImages).toHaveBeenCalledWith(
        uploaded,
        expect.any(String),
      );
      expect(useStore.getState().pendingItemImages).toBeNull();
    });

    it('shows the created item, with the brand typed, and closes the form', async () => {
      const { result } = renderHookWithApollo(
        () => useSearchResults('UNKNOWN'),
        {
          operationMocks: [
            ...missedLookups(),
            createItemMock({ name: 'New Item' }),
          ],
        },
      );
      await waitFor(() => expect(mockShowBottomSheet).toHaveBeenCalled());
      mockHideBottomSheet.mockClear();

      await act(async () => {
        await result.current.handleAddItem({
          name: 'New Item',
          brandName: 'Home Brand',
        });
      });

      expect(result.current.item).toEqual(
        expect.objectContaining({
          id: 'new-item',
          name: 'New Item',
          upc: 'UNKNOWN',
          brandName: 'Home Brand',
        }),
      );
      expect(mockHideBottomSheet).toHaveBeenCalled();
    });

    // The created item is read from the cache by its id, not kept as the
    // mutation returned it, so an edit made afterwards reaches the card.
    it('re-renders the created item when it is edited', async () => {
      const cache = makeCache();
      const { result } = renderHookWithApollo(
        () => useSearchResults('UNKNOWN'),
        {
          cache,
          operationMocks: [
            ...missedLookups(),
            createItemMock({ name: 'New Item' }),
          ],
        },
      );
      await waitFor(() => expect(mockShowBottomSheet).toHaveBeenCalled());
      await act(async () => {
        await result.current.handleAddItem({ name: 'New Item' });
      });
      expect(result.current.item?.name).toBe('New Item');

      act(() => {
        cache.modify({
          id: cache.identify({ __typename: 'Item', id: 'new-item' }),
          fields: { name: () => 'Renamed Item' },
        });
      });

      await waitFor(() =>
        expect(result.current.item?.name).toBe('Renamed Item'),
      );
    });

    it('shows the photo uploaded for the created item', async () => {
      mockUploadItemImages.mockResolvedValueOnce([
        { imageUrl: 'https://cdn.test/new-item.jpg' },
      ]);
      const { result } = renderHookWithApollo(
        () => useSearchResults('UNKNOWN'),
        {
          operationMocks: [
            ...missedLookups(),
            createItemMock({ imageUrl: null }),
          ],
        },
      );
      await waitFor(() => expect(mockShowBottomSheet).toHaveBeenCalled());

      await act(async () => {
        await result.current.handleAddItem({
          name: 'New Item',
          selectedImages: [{ uri: 'file://image.jpg' }],
        });
      });

      await waitFor(() =>
        expect(result.current.item?.imageUrl).toBe(
          'https://cdn.test/new-item.jpg',
        ),
      );
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
      expect(result.current.item).toBeNull();
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
        refusal = await result.current.handleAddItem({
          name: 'New Item',
          selectedImages: [{ uri: 'file://image.jpg' }],
        });
      });

      expect(refusal).toBeUndefined();
      expect(alertService.alert).toHaveBeenCalledTimes(1);
      // Nothing was created to attach them to.
      expect(mockUploadItemImages).not.toHaveBeenCalled();
      expect(useStore.getState().pendingItemImages).toBeNull();
    });
  });
});
