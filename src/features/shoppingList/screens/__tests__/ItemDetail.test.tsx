'use no memo';

import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import type { MockLink } from '@apollo/client/testing';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { ShoppingListItemDetail } from '../ItemDetail';
import { GetShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
  parseImages: jest.fn(() => []),
  hasImages: jest.fn(() => false),
}));
jest.mock('#utils/nutritionUtils', () => ({
  parseNutritions: jest.fn(() => []),
  hasNutritionData: jest.fn(() => false),
}));
jest.mock('#hooks/performance/useScreenTransition');
jest.mock('#/styles/commonStyles', () => ({
  commonStyles: { title: {}, body: {}, caption: {} },
}));

jest.mock('#components/templates/DetailTemplate', () => ({
  DetailTemplate: ({ title, sections }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="detail-template">
        <Text>{title}</Text>
        {sections.map((section: any, i: number) => (
          <View key={i}>
            {section.title ? <Text>{section.title}</Text> : null}
            {section.content}
          </View>
        ))}
      </View>
    );
  },
}));
jest.mock('#components/molecules/ClickableInfoPanel', () => ({
  ClickableInfoPanel: ({ title, emptyMessage }: any) => {
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
jest.mock('#components/molecules/ImageGalleryTabs', () => ({
  ImageGalleryTabs: () => null,
}));
jest.mock('#components/atoms/FormattedItemSubtitle', () => ({
  FormattedItemSubtitle: () => {
    const { Text } = require('react-native');
    return <Text>2 loaves</Text>;
  },
}));
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

function buildShoppingListItem(overrides: Partial<Record<string, any>> = {}) {
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
    priority: 'HIGH',
    notes: 'Get whole wheat',
    version: 1,
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-02T00:00:00Z',
    sortOrder: 0,
    item: null,
    purchaseInfo: { __typename: 'PurchaseInfo', isPurchased: false },
    purchasesConnection: {
      __typename: 'PurchaseConnection',
      edges: [],
      totalCount: 0,
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
    source: null,
    priceEstimate: null,
    ...overrides,
  };
}

function buildItemMock(
  itemId: string,
  item: any | null,
): MockLink.MockedResponse {
  return {
    request: { query: GetShoppingListItemDocument, variables: { id: itemId } },
    result: { data: { shoppingListItem: item } },
    maxUsageCount: 10,
  };
}

describe('ShoppingListItemDetail', () => {
  const route = { params: { listId: 'sl1', itemId: 'si1' } };

  it('renders the item name', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getByText('Bread')).toBeTruthy());
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

  it('shows priority', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await waitFor(() => expect(screen.getByText('HIGH')).toBeTruthy());
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
});
