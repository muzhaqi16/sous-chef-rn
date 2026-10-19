'use no memo';

import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { ApolloClient, ApolloLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import {
  completeMockedResponse,
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createOfflineModeLink } from '#/apollo/links/offlineModeLink';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { useStore } from '#store';
import { kitTestIDs } from '#components/testIDs';
import { ShoppingListItemDetail } from '../ItemDetail';
import {
  GetShoppingListItemDocument,
  GetShoppingListItemsFilteredDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { AddedContext } from '#/graphql/generated/schemaTypes';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import { resolveImageUrl } from '#utils/imageUtils';

const mockUseShowShoppingListImages =
  useShowShoppingListImages as jest.MockedFunction<
    typeof useShowShoppingListImages
  >;
const mockResolveImageUrl = resolveImageUrl as jest.MockedFunction<
  typeof resolveImageUrl
>;

jest.mock('#hooks/navigation/useAppNavigation');

// `resolveImageUrl` is mocked so each test can drive hero resolution directly;
// everything else keeps its real implementation (a partial factory would drop
// `galleryPhotos` and the perspective helpers the gallery needs).
jest.mock('#utils/imageUtils', () => ({
  ...jest.requireActual('#utils/imageUtils'),
  resolveImageUrl: jest.fn(() => null),
}));
jest.mock('#domain/nutrition', () => ({
  hasNutritionData: jest.fn(() => false),
}));
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#features/catalog/ui/NutritionSummary', () => ({
  NutritionSummary: () => null,
}));
jest.mock('#features/catalog/ui/ItemPhotoCarousel', () => ({
  ItemPhotoCarousel: () => null,
}));
jest.mock('#components/molecules/FormattedItemSubtitle', () => ({
  FormattedItemSubtitle: () => {
    const { Text } = require('react-native');
    return <Text>2 loaves</Text>;
  },
}));
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: ({
    testID,
    uri,
    onError,
  }: {
    testID?: string;
    uri?: string | null;
    onError?: () => void;
  }) => {
    const { View } = require('react-native');
    const ReactLocal = require('react');
    // Simulate a broken/unreachable image so the failure-collapse path is
    // exercised without a real network load.
    ReactLocal.useEffect(() => {
      if (uri === 'BROKEN') onError?.();
    }, [uri, onError]);
    return <View testID={testID} />;
  },
}));

jest.mock('#hooks/settings/useUserPreferences', () => ({
  useShowShoppingListImages: jest.fn(() => true),
}));

function buildShoppingListItem(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'ShoppingListItem',
    id: 'si1',
    itemName: 'Bread',
    quantity: '2',
    quantityInput: '2',
    displayFormat: null,
    unitName: 'loaves',
    unit: null,
    category: 'Bakery',
    priority: 2,
    notes: 'Get whole wheat',
    version: 1,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-02T00:00:00Z',
    item: null,
    priceEstimate: {
      __typename: 'PriceEstimate',
      estimated: 4.59,
    },
    storeInfo: {
      __typename: 'ShoppingListItemStoreInfo',
      preferredStore: {
        __typename: 'Store',
        id: 'store-1',
        name: 'Costco',
      },
    },
    brand: null,
    netWeight: null,
    netWeightUnit: null,
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
      movedToPantryAt: null,
      purchasedQuantity: null,
      purchasedPrice: null,
      purchaseDate: null,
      purchasedBy: null,
    },
    purchaseHistory: {
      __typename: 'PurchaseHistorySummary',
      previouslyPurchased: false,
      purchaseCount: 0,
      lastPurchaseDate: null,
    },
    addedBy: {
      __typename: 'User',
      id: 'u1',
      email: 'test@test.com',
      profile: {
        __typename: 'UserProfile',
        id: 'profile-1',
        displayName: 'Test User',
        avatar: null,
      },
    },
    lastEditedBy: null,
    source: {
      __typename: 'ShoppingListItemSource',
      addedContext: AddedContext.Manual,
      isFromMealPlan: false,
    },
    ...overrides,
  };
}

function buildItemMock(
  itemId: string,
  item: Record<string, unknown> | null,
): MockLink.MockedResponse {
  return {
    request: { query: GetShoppingListItemDocument, variables: { id: itemId } },
    result: { data: { shoppingListItem: item } },
    maxUsageCount: 10,
  };
}

describe('ShoppingListItemDetail', () => {
  const route = { params: { listId: 'sl1', itemId: 'si1' } };

  beforeEach(() => {
    mockUseShowShoppingListImages.mockReturnValue(true);
    mockResolveImageUrl.mockReturnValue(null);
  });

  it('renders the item name', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getAllByText('Bread')[0]).toBeTruthy());
  });

  it('renders the detail template title', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getByText('Item Details')).toBeTruthy());
  });

  it('shows category', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getByText('Bakery')).toBeTruthy());
  });

  it('shows priority as a label, not the raw integer', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getByText('High')).toBeTruthy());
    expect(screen.queryByText('2')).toBeNull();
  });

  it('shows the brand and package size', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            brand: { __typename: 'Brand', id: 'brand-1', name: 'Oatly' },
            netWeight: 500,
            netWeightUnit: {
              __typename: 'Unit',
              id: 'unit-g',
              name: 'gram',
              symbol: 'g',
            },
          }),
        ),
      ],
    });
    await waitFor(() => expect(screen.getByText('Oatly')).toBeTruthy());
    expect(screen.getByText('500 g')).toBeTruthy();
  });

  it('shows the estimated price', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getByText('$4.59')).toBeTruthy());
  });

  it('shows the preferred store', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getByText('Costco')).toBeTruthy());
  });

  it('names who purchased the item from their profile', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: true,
              movedToPantryAt: null,
              purchasedQuantity: 2,
              purchasedPrice: 3.5,
              purchaseDate: '2026-08-19T00:00:00Z',
              purchasedBy: {
                __typename: 'User',
                id: 'u2',
                displayName: null,
                profile: {
                  __typename: 'UserProfile',
                  id: 'profile-2',
                  displayName: 'Sam',
                  avatar: null,
                },
              },
            },
          }),
        ),
      ],
    });

    await waitFor(() => expect(screen.getByText('Purchased By')).toBeTruthy());
    expect(screen.getByText('Sam')).toBeTruthy();
  });

  // A profile without a display name, or one kept private, still names the
  // purchaser to someone sharing the list.
  it('names the purchaser by the name the shared list gives them', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: true,
              movedToPantryAt: null,
              purchasedQuantity: 1,
              purchasedPrice: null,
              purchaseDate: '2026-10-16T00:00:00Z',
              purchasedBy: {
                __typename: 'User',
                id: 'u3',
                displayName: 'John',
                profile: null,
              },
            },
          }),
        ),
      ],
    });

    await waitFor(() => expect(screen.getByText('Purchased By')).toBeTruthy());
    expect(screen.getByText('John')).toBeTruthy();
    expect(screen.queryByText('Someone')).toBeNull();
  });

  it('shows the total paid, with the per-unit price beneath it', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: true,
              movedToPantryAt: null,
              purchasedQuantity: 2,
              purchasedPrice: 3.5,
              purchaseDate: '2026-08-19T00:00:00Z',
              purchasedBy: null,
            },
          }),
        ),
      ],
    });

    await waitFor(() => expect(screen.getByText('Total paid')).toBeTruthy());
    // The API stores 3.50 PER UNIT; the shopper paid 7.00 for the two.
    expect(screen.getByText('$7.00')).toBeTruthy();
    expect(screen.getByText('$3.50 per loaves')).toBeTruthy();
    // Purchased amount and requested quantity are separate rows, both "2 loaves".
    expect(screen.getAllByText('2 loaves')).toHaveLength(2);
  });

  it('omits the per-unit line when one unit was bought', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: true,
              movedToPantryAt: null,
              purchasedQuantity: 1,
              purchasedPrice: 3.5,
              purchaseDate: '2026-08-19T00:00:00Z',
              purchasedBy: null,
            },
          }),
        ),
      ],
    });

    await waitFor(() => expect(screen.getByText('Total paid')).toBeTruthy());
    expect(screen.getByText('$3.50')).toBeTruthy();
    expect(screen.queryByText('$3.50 per loaves')).toBeNull();
  });

  it('omits the purchaser row when the item is not purchased', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });

    await waitFor(() => expect(screen.getByText('Item Details')).toBeTruthy());
    expect(screen.queryByText('Purchased By')).toBeNull();
  });

  it('shows notes', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() =>
      expect(screen.getByText('Get whole wheat')).toBeTruthy(),
    );
  });

  it('shows purchase history panel', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() =>
      expect(screen.getByText('Purchase History')).toBeTruthy(),
    );
  });

  it("dates the most recent purchase by a receipt's printed day", async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            purchaseHistory: {
              __typename: 'PurchaseHistorySummary',
              previouslyPurchased: true,
              purchaseCount: 1,
              lastPurchaseDate: '2026-10-17T00:00:00Z',
            },
          }),
        ),
      ],
    });
    expect(await screen.findByText('Oct 17, 2026')).toBeTruthy();
  });

  it('shows the loading state while nothing is cached or answered', () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [],
    });
    expect(screen.getByTestId(kitTestIDs.stateLoading)).toBeTruthy();
  });

  it('shows added-by info', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getByText('Added By')).toBeTruthy());
    expect(screen.getByText('Test User')).toBeTruthy();
  });

  describe('where the line was added from', () => {
    const renderWithSource = (
      addedContext: AddedContext,
      fromMealPlan = false,
    ) =>
      renderWithApollo(<ShoppingListItemDetail route={route} />, {
        operationMocks: [
          buildItemMock(
            'si1',
            buildShoppingListItem({
              source: {
                __typename: 'ShoppingListItemSource',
                addedContext,
                isFromMealPlan: fromMealPlan,
              },
            }),
          ),
        ],
      });

    it('names a low-stock line', async () => {
      renderWithSource(AddedContext.LowStock);

      await waitFor(() => expect(screen.getByText('Added From')).toBeTruthy());
      expect(screen.getByText('A low-stock item')).toBeTruthy();
    });

    it('names a line added from a recipe', async () => {
      renderWithSource(AddedContext.FromRecipe);

      await waitFor(() => expect(screen.getByText('Added From')).toBeTruthy());
      expect(screen.getByText('A recipe')).toBeTruthy();
    });

    it('says nothing for a line someone typed in', async () => {
      renderWithSource(AddedContext.Manual);

      await waitFor(() => expect(screen.getByText('Added By')).toBeTruthy());
      expect(screen.queryByText('Added From')).toBeNull();
      expect(screen.queryByText('From Meal Plan')).toBeNull();
    });

    // A meal-plan line keeps its own row; a second one naming the same origin
    // would say it twice.
    it('leaves a meal-plan line to its own row', async () => {
      renderWithSource(AddedContext.FromMealPlan, true);

      await waitFor(() =>
        expect(screen.getByText('From Meal Plan')).toBeTruthy(),
      );
      expect(screen.queryByText('Added From')).toBeNull();
    });
  });

  it('renders the hero image when one resolves and images are enabled', async () => {
    mockResolveImageUrl.mockReturnValue('https://cdn.example.com/bread.jpg');
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() =>
      expect(screen.getByTestId('shopping-item-hero-image')).toBeTruthy(),
    );
  });

  it('omits the hero when the user has disabled images', async () => {
    mockUseShowShoppingListImages.mockReturnValue(false);
    mockResolveImageUrl.mockReturnValue('https://cdn.example.com/bread.jpg');
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getAllByText('Bread')[0]).toBeTruthy());
    expect(screen.queryByTestId('shopping-item-hero-image')).toBeNull();
  });

  it('omits the hero when no image is available', async () => {
    mockResolveImageUrl.mockReturnValue(null);
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getAllByText('Bread')[0]).toBeTruthy());
    expect(screen.queryByTestId('shopping-item-hero-image')).toBeNull();
  });

  it('collapses the hero when its image fails to load', async () => {
    mockResolveImageUrl.mockReturnValue('BROKEN');
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getAllByText('Bread')[0]).toBeTruthy());
    // The mocked CachedImage fires onError for the 'BROKEN' uri, which should
    // drop the hero rather than leaving a broken-image placeholder.
    await waitFor(() =>
      expect(screen.queryByTestId('shopping-item-hero-image')).toBeNull(),
    );
  });

  it('says a line the server holds nothing for is not found', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', null)],
    });
    expect(await screen.findByText('Item not found')).toBeTruthy();
  });

  // The list's row caches a subset of what the detail selects, so the detail's
  // own query is an incomplete cache read until it has answered once. Known
  // offline, the real `offlineModeLink` answers that miss with `data: null`;
  // before the device reports its link (or with only the breaker open) the miss
  // goes to the network and fails there with `data: undefined`.
  describe('when the detail query cannot be answered', () => {
    const LIST_VARIABLES = { id: 'sl1', first: 50, isPurchased: false };
    const initialNetwork = useStore.getState();

    afterEach(() => {
      useStore.setState({
        isOnline: initialNetwork.isOnline,
        apiReachable: initialNetwork.apiReachable,
      });
      act(() => {
        unconfirmedCreates.confirm('si1');
      });
    });

    const listRowMock = () =>
      recordMock(GetShoppingListItemsFilteredDocument, {
        data: {
          shoppingList: {
            id: 'sl1',
            itemsConnection: {
              edges: [
                {
                  node: {
                    id: 'si1',
                    itemName: 'Bread',
                    category: 'Bakery',
                    notes: 'Get whole wheat',
                    item: null,
                  },
                },
              ],
            },
          },
        },
      }).mock;

    const detailMock = () =>
      recordMock(GetShoppingListItemDocument, {
        data: {
          shoppingListItem: {
            id: 'si1',
            itemName: 'Bread',
            category: 'Bakery',
            item: null,
            storeInfo: { preferredStore: { id: 'store-1', name: 'Costco' } },
          },
        },
      }).mock;

    const failingDetailMock = () =>
      recordMock(GetShoppingListItemDocument, {
        error: new Error('Network request failed'),
      }).mock;

    /**
     * The production cache and offline link, in front of a mocked API.
     * `offline`: the device has reported no link. `failing`: it has not, and
     * the request fails in transport.
     */
    async function renderDetail({
      listCached,
      network,
      detail = network === 'failing' ? failingDetailMock() : detailMock(),
    }: {
      listCached: boolean;
      network: 'online' | 'offline' | 'failing';
      detail?: MockLink.MockedResponse;
    }) {
      const client = new ApolloClient({
        cache: makeCache(),
        link: ApolloLink.from([
          createOfflineModeLink(),
          new MockLink([listRowMock(), detail].map(completeMockedResponse)),
        ]),
        defaultOptions: APOLLO_DEFAULT_OPTIONS,
      });
      if (listCached) {
        await client.query({
          query: GetShoppingListItemsFilteredDocument,
          variables: LIST_VARIABLES,
        });
      }
      if (network === 'offline') {
        act(() => {
          useStore.setState({ isOnline: false, apiReachable: null });
        });
      }
      return render(
        <ApolloProvider client={client}>
          <ShoppingListItemDetail route={route} />
        </ApolloProvider>,
      );
    }

    it.each(['offline', 'failing'] as const)(
      'renders the cached row (%s) instead of loading or not-found',
      async network => {
        await renderDetail({ listCached: true, network });

        expect(await screen.findByText('Bakery')).toBeTruthy();
        expect(screen.getAllByText('Bread')[0]).toBeTruthy();
        expect(screen.getByText('Get whole wheat')).toBeTruthy();
        expect(screen.queryByTestId(kitTestIDs.stateLoading)).toBeNull();
        expect(screen.queryByText('Item not found')).toBeNull();
      },
    );

    it('claims nothing the row does not hold', async () => {
      await renderDetail({ listCached: true, network: 'offline' });

      await screen.findByText('Bakery');
      // Never fetched, so neither "no history" nor "added: never" is known.
      expect(screen.queryByText('No purchase history available')).toBeNull();
      expect(screen.queryByText('Additional Details')).toBeNull();
      expect(screen.queryByText('Added On')).toBeNull();
      expect(screen.queryByText('Never')).toBeNull();
    });

    it('renders a line created here without asking the server for it', async () => {
      unconfirmedCreates.mark('si1');
      const noSuchLine = recordMock(GetShoppingListItemDocument, {
        data: { shoppingListItem: null },
      });
      await renderDetail({
        listCached: true,
        network: 'online',
        detail: noSuchLine.mock,
      });

      expect(await screen.findByText('Bakery')).toBeTruthy();
      expect(screen.queryByText('Item not found')).toBeNull();
      expect(noSuchLine.fired).toHaveLength(0);
    });

    it('fills in the detail-only fields when the network answers', async () => {
      await renderDetail({ listCached: true, network: 'online' });

      expect(await screen.findByText('Costco')).toBeTruthy();
      expect(screen.getByText('Bakery')).toBeTruthy();
    });

    it('reports an offline cache miss as offline', async () => {
      await renderDetail({ listCached: false, network: 'offline' });

      expect(await screen.findByTestId(kitTestIDs.stateOffline)).toBeTruthy();
      expect(screen.queryByText('Item not found')).toBeNull();
    });

    it('loads the detail on retry once the connection is back', async () => {
      await renderDetail({ listCached: false, network: 'offline' });
      await screen.findByTestId(kitTestIDs.stateOffline);

      act(() => {
        useStore.setState({ isOnline: true, apiReachable: true });
      });
      fireEvent.press(screen.getByText('Try again'));

      expect(await screen.findByText('Costco')).toBeTruthy();
    });

    it('reports a failed fetch with nothing cached, not a spinner', async () => {
      await renderDetail({ listCached: false, network: 'failing' });

      expect(await screen.findByTestId(kitTestIDs.stateError)).toBeTruthy();
      expect(screen.queryByTestId(kitTestIDs.stateLoading)).toBeNull();
    });
  });
});
