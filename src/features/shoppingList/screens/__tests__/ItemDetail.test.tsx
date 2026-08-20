'use no memo';

import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import type { MockLink } from '@apollo/client/testing';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { ShoppingListItemDetail } from '../ItemDetail';
import { GetShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { useShowShoppingListImages } from '#hooks/settings/useUserPreferences';
import { resolveImageUrl } from '#utils/imageUtils';

const mockUseShowShoppingListImages =
  useShowShoppingListImages as jest.MockedFunction<
    typeof useShowShoppingListImages
  >;
const mockResolveImageUrl = resolveImageUrl as jest.MockedFunction<
  typeof resolveImageUrl
>;

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

// `resolveImageUrl` is mocked so each test can drive hero resolution directly;
// everything else keeps its real implementation (a partial factory would drop
// `galleryPhotos` and the perspective helpers the gallery needs).
jest.mock('#utils/imageUtils', () => ({
  ...jest.requireActual('#utils/imageUtils'),
  resolveImageUrl: jest.fn(() => null),
}));
jest.mock('#utils/nutritionUtils', () => ({
  parseNutritions: jest.fn(() => []),
  hasNutritionData: jest.fn(() => false),
}));
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#components/molecules/ClickableInfoPanel', () => ({
  ClickableInfoPanel: ({
    title,
    emptyMessage,
  }: {
    title: string;
    emptyMessage?: string;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {emptyMessage ? <Text>{emptyMessage}</Text> : null}
      </View>
    );
  },
}));
jest.mock('#components/molecules/NutritionSummary', () => ({
  NutritionSummary: () => null,
}));
jest.mock('#components/molecules/ItemPhotoCarousel', () => ({
  ItemPhotoCarousel: () => null,
}));
jest.mock('#components/atoms/FormattedItemSubtitle', () => ({
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
    sortOrder: 0,
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
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
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
    source: null,
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

  it('names who purchased the item', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: true,
              purchasedQuantity: 2,
              purchasedPrice: 3.5,
              purchaseDate: '2026-08-19T00:00:00Z',
              purchasedBy: {
                __typename: 'User',
                id: 'u2',
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
    // The amounts row alongside it.
    expect(screen.getByText('2 @ $3.50')).toBeTruthy();
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

  it('shows loading text when data is undefined', () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [],
    });
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows added-by info', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getByText('Added By')).toBeTruthy());
    expect(screen.getByText('Test User')).toBeTruthy();
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
});
