'use no memo';

import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ApolloClient, ApolloLink } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import {
  completeMockedResponse,
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createOfflineReadLink } from '#/apollo/links/offlineReadLink';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { useStore } from '#store';
import { kitTestIDs } from '#components/testIDs';
import { CachedImage } from '#components/atoms/CachedImage';
import { ShoppingListItemDetail } from '../ItemDetail';
import { GetShoppingListItemsFilteredDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { GetShoppingListItemDocument } from '../useShoppingListItemDetail.generated';
import { StoreShelfPricesDocument } from '#features/catalog/hooks/useStoreShelfPrices.generated';
import { catalogTestIDs } from '#features/catalog/testIDs';
import { t } from '#/i18n';
import {
  EntryImageSource,
  ItemImageStatus,
} from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { AddedContext } from '#/graphql/generated/schemaTypes';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

function buildShoppingListItem(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'ShoppingListItem',
    id: 'si1',
    itemName: 'Bread',
    // Stated, or completion gives the line a household photo.
    image: null,
    quantity: '2',
    quantityInput: '2',
    displayFormat: null,
    unitName: 'loaves',
    category: 'Bakery',
    priority: 2,
    notes: 'Get whole wheat',
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
    // A private profile reads null to the list's people; the shared name does not.
    addedBy: {
      __typename: 'User',
      id: 'u1',
      email: 'test@test.com',
      displayName: 'Test User',
      profile: null,
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

let log = operationLog();

beforeEach(() => {
  log = operationLog();
});

describe('ShoppingListItemDetail', () => {
  const route = { params: { listId: 'sl1', itemId: 'si1' } };

  /** The detail, open on `line`, its read landed. */
  async function openDetail(line: Record<string, unknown>) {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', line)],
    });
    await log.landed(GetShoppingListItemDocument);
  }

  it('opens the line’s edit', async () => {
    await openDetail(buildShoppingListItem());

    fireEvent.press(
      screen.getByTestId(shoppingListTestIDs.itemDetailEditButton),
    );

    expect(mockNav.toEditItem).toHaveBeenCalledWith({
      listId: 'sl1',
      itemId: 'si1',
    });
  });

  it('opens its purchase history', async () => {
    await openDetail(
      buildShoppingListItem({
        purchaseHistory: {
          __typename: 'PurchaseHistorySummary',
          previouslyPurchased: true,
          purchaseCount: 3,
          lastPurchaseDate: '2024-05-20T00:00:00Z',
        },
      }),
    );

    fireEvent.press(screen.getByText(t('labels.purchaseHistory')));

    expect(mockNav.toPurchaseHistory).toHaveBeenCalledWith({
      itemId: 'si1',
      itemName: 'Bread',
    });
  });

  it('does not call a line still to buy purchased', async () => {
    await openDetail(buildShoppingListItem());

    expect(screen.queryByText(t('labels.purchased'))).toBeNull();
  });

  it('names no editor who only added it, and no update to an untouched line', async () => {
    await openDetail(
      buildShoppingListItem({
        lastEditedBy: {
          __typename: 'User',
          id: 'u1',
          displayName: 'Test User',
          profile: null,
        },
        updatedAt: '2024-06-01T00:00:00Z',
      }),
    );

    expect(screen.getByText(t('shoppingListScreens.addedBy'))).toBeTruthy();
    expect(
      screen.queryByText(t('shoppingListScreens.lastEditedBy')),
    ).toBeNull();
    expect(screen.queryByText(t('shoppingListScreens.lastUpdated'))).toBeNull();
  });

  // A concept's typical values make no claim about the product's own.
  it('titles a concept’s typical nutrition as typical, not as the product’s', async () => {
    await openDetail(
      buildShoppingListItem({
        item: {
          __typename: 'Item',
          id: 'i1',
          shownNutrition: {
            __typename: 'ShownNutrition',
            facts: {
              __typename: 'NutritionFacts',
              id: 'nf1',
              calories: 250,
              protein: 9,
            },
            typicalOf: {
              __typename: 'FoodConcept',
              id: 'c1',
              name: 'bread',
            },
          },
        },
      }),
    );

    expect(
      screen.getByText(t('labels.typicalFor', { concept: 'bread' })),
    ).toBeTruthy();
    expect(screen.queryByText(t('dietary.nutritionGoals'))).toBeNull();
  });

  beforeEach(() => {
    useStore.setState({
      user: {
        id: 'u1',
        email: 'test@test.com',
        emailVerified: true,
        onBoarded: true,
      },
      budgetAndPrices: true,
    });
    useStore
      .getState()
      .setUserPreference('u1', { showShoppingListImages: true });
  });

  it('renders the item name', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getAllByText('Bread')[0]).toBeTruthy();
  });

  it('renders the detail template title while the item loads', () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    // The bar's title is hidden from screen readers: it copies the body title.
    expect(
      screen.getByText('Item Details', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  it('shows category', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Bakery')).toBeTruthy();
  });

  it('shows priority as a label, not the raw integer', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.queryByText('2')).toBeNull();
  });

  it('shows the brand and package size', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            brand: { __typename: 'Brand', id: 'brand-1', name: 'Oatly' },
            netWeight: 500,
            netWeightUnit: asAbbreviation({
              __typename: 'Unit',
              id: 'unit-g',
              name: 'gram',
              symbol: 'g',
            }),
          }),
        ),
      ],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Oatly')).toBeTruthy();
    expect(screen.getByText('500 g')).toBeTruthy();
  });

  it('shows the estimated price', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('$4.59')).toBeTruthy();
  });

  it('shows no estimate or amount paid with prices turned off', async () => {
    useStore.setState({ budgetAndPrices: false });
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
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

    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Costco')).toBeTruthy();
    expect(screen.queryByText('$4.59')).toBeNull();
    expect(screen.queryByText('Total paid')).toBeNull();
    expect(screen.queryByText('$7.00')).toBeNull();
  });

  describe('prices at stores', () => {
    const lineWithItem = () =>
      buildItemMock(
        'si1',
        buildShoppingListItem({ item: { __typename: 'Item', id: 'cat-1' } }),
      );
    const priceAt = (id: string, name: string, price: number) => ({
      store: { id, name },
      price,
      regularPrice: price,
      onPromotion: false,
      typicalPrice: price,
      lowestPrice: price,
      coveredDays: 90,
      normalizedPrice: null,
      normalizedBasis: null,
      isCurrent: true,
      confirmedAt: '2026-10-26T12:00:00.000Z',
      aisle: null,
      unit: { id: 'u-lb', symbol: 'lb' },
      currency: {
        id: 'usd',
        code: 'USD',
        decimalPlaces: 2,
      },
    });
    const shelfMock = (
      nodes: ReturnType<typeof priceAt>[],
      similarStorePrices: object[] = [],
    ) =>
      recordMock(StoreShelfPricesDocument, {
        data: {
          item: {
            id: 'cat-1',
            storePricesConnection: {
              edges: nodes.map(node => ({ node })),
            },
            similarStorePrices,
          },
        },
      });

    it("lists each store's shelf price under its heading", async () => {
      const shelf = shelfMock([
        priceAt('s-aldi', 'ALDI', 1.99),
        priceAt('s-ge', 'Giant Eagle', 2.49),
      ]);
      renderWithApollo(<ShoppingListItemDetail route={route} />, {
        links: [log.link],
        operationMocks: [lineWithItem(), shelf.mock],
      });

      await log.landed(GetShoppingListItemDocument);
      await log.landed(StoreShelfPricesDocument);
      expect(screen.getByText(t('storeShelfPrices.title'))).toBeTruthy();
      expect(
        screen.getByTestId(catalogTestIDs.storeShelfPrice('s-aldi')),
      ).toBeTruthy();
      expect(
        screen.getByTestId(catalogTestIDs.storeShelfPrice('s-ge')),
      ).toBeTruthy();
      expect(shelf.fired).toEqual([{ itemId: 'cat-1' }]);
    });

    // A store that lacks the product still shows, as another product of its kind.
    it('lists similar products under the stores, even with no store pricing the item', async () => {
      const shelf = shelfMock(
        [],
        [
          {
            store: { id: 's-kroger', name: 'Kroger' },
            product: { id: 'cat-2', name: 'Kroger Whole Milk' },
            price: 3.29,
            unit: { id: 'u-gal', symbol: 'gal' },
            packageNetWeight: null,
            packageNetWeightUnit: null,
            normalizedPrice: 0.87,
            basis: 'PER_L',
            currency: { id: 'usd', code: 'USD', decimalPlaces: 2 },
          },
        ],
      );
      renderWithApollo(<ShoppingListItemDetail route={route} />, {
        links: [log.link],
        operationMocks: [lineWithItem(), shelf.mock],
      });

      await log.landed(GetShoppingListItemDocument);
      await log.landed(StoreShelfPricesDocument);
      expect(screen.getByText(t('storeShelfPrices.similarTitle'))).toBeTruthy();
      expect(screen.getByText('Kroger Whole Milk')).toBeTruthy();
      expect(
        screen.getByTestId(catalogTestIDs.storeShelfSimilarPrice('s-kroger')),
      ).toBeTruthy();
    });

    it('shows and asks for none with prices turned off', async () => {
      useStore.setState({ budgetAndPrices: false });
      const shelf = shelfMock([priceAt('s-aldi', 'ALDI', 1.99)]);
      renderWithApollo(<ShoppingListItemDetail route={route} />, {
        links: [log.link],
        operationMocks: [lineWithItem(), shelf.mock],
      });

      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByText('Costco')).toBeTruthy();
      expect(screen.queryByText(t('storeShelfPrices.title'))).toBeNull();
      expect(shelf.fired).toEqual([]);
    });

    it('shows no section for an item no store has priced', async () => {
      const shelf = shelfMock([]);
      renderWithApollo(<ShoppingListItemDetail route={route} />, {
        links: [log.link],
        operationMocks: [lineWithItem(), shelf.mock],
      });

      await log.landed(GetShoppingListItemDocument);
      await log.landed(StoreShelfPricesDocument);
      expect(shelf.fired).toHaveLength(1);
      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByText('Costco')).toBeTruthy();
      expect(screen.queryByText(t('storeShelfPrices.title'))).toBeNull();
    });
  });

  it('shows the preferred store', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Costco')).toBeTruthy();
  });

  it('names who purchased the item from their profile', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
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

    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Purchased By')).toBeTruthy();
    expect(screen.getByText('Sam')).toBeTruthy();
  });

  // A profile without a display name, or one kept private, still names the
  // purchaser to someone sharing the list.
  it('names the purchaser by the name the shared list gives them', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
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

    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Purchased By')).toBeTruthy();
    expect(screen.getByText('John')).toBeTruthy();
    expect(screen.queryByText('Someone')).toBeNull();
  });

  it('shows the total paid, with the per-unit price beneath it', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
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

    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Total paid')).toBeTruthy();
    // The API stores 3.50 PER UNIT; the shopper paid 7.00 for the two.
    expect(screen.getByText('$7.00')).toBeTruthy();
    expect(screen.getByText('$3.50 per loaves')).toBeTruthy();
    // Purchased amount and requested quantity are separate rows, both "2 loaves".
    expect(screen.getAllByText('2 loaves')).toHaveLength(2);
  });

  it('omits the per-unit line when one unit was bought', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
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

    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Total paid')).toBeTruthy();
    expect(screen.getByText('$3.50')).toBeTruthy();
    expect(screen.queryByText('$3.50 per loaves')).toBeNull();
  });

  it('omits the purchaser row when the item is not purchased', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });

    await log.landed(GetShoppingListItemDocument);
    expect(screen.getAllByText('Bread')[0]).toBeTruthy();
    expect(screen.queryByText('Purchased By')).toBeNull();
  });

  it('shows notes', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Get whole wheat')).toBeTruthy();
  });

  it('shows purchase history panel', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Purchase History')).toBeTruthy();
  });

  it("dates the most recent purchase by a receipt's printed day", async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
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
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Oct 17, 2026')).toBeTruthy();
  });

  it('shows the loading state while nothing is cached or answered', () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [],
    });
    expect(screen.getByTestId(kitTestIDs.stateLoading)).toBeTruthy();
  });

  it('shows added-by info', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Added By')).toBeTruthy();
    expect(screen.getByText('Test User')).toBeTruthy();
  });

  it('names who last edited the line by the name the list shares', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            lastEditedBy: {
              __typename: 'User',
              id: 'u2',
              displayName: 'Sam',
              profile: null,
            },
          }),
        ),
      ],
    });

    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Last Edited By')).toBeTruthy();
    expect(screen.getByText('Sam')).toBeTruthy();
  });

  describe('where the line was added from', () => {
    const renderWithSource = (
      addedContext: AddedContext,
      fromMealPlan = false,
    ) =>
      renderWithApollo(<ShoppingListItemDetail route={route} />, {
        links: [log.link],
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

      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByText('Added From')).toBeTruthy();
      expect(screen.getByText('A low-stock item')).toBeTruthy();
    });

    it('names a line added from a recipe', async () => {
      renderWithSource(AddedContext.FromRecipe);

      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByText('Added From')).toBeTruthy();
      expect(screen.getByText('A recipe')).toBeTruthy();
    });

    it('says nothing for a line someone typed in', async () => {
      renderWithSource(AddedContext.Manual);

      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByText('Added By')).toBeTruthy();
      expect(screen.queryByText('Added From')).toBeNull();
      expect(screen.queryByText('From Meal Plan')).toBeNull();
    });

    // A meal-plan line keeps its own row; a second one naming the same origin
    // would say it twice.
    it('leaves a meal-plan line to its own row', async () => {
      renderWithSource(AddedContext.FromMealPlan, true);

      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByText('From Meal Plan')).toBeTruthy();
      expect(screen.queryByText('Added From')).toBeNull();
    });
  });

  it('renders the hero image when one resolves and images are enabled', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            item: {
              __typename: 'Item',
              id: 'i1',
              imageUrl: 'https://cdn.example.com/bread.jpg',
              photos: [],
            },
          }),
        ),
      ],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByTestId('shopping-item-hero-image')).toBeTruthy();
  });

  // The household overrides the item photo on its own entries.
  it("leads the hero with the household's own photo", async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            image: {
              __typename: 'EntryImage',
              url: 'https://signed.example.com/our-bread.jpg',
              source: EntryImageSource.Household,
              catalogImageId: null,
            },
          }),
        ),
      ],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(
      screen.UNSAFE_root.findAll(
        node => node.props.uri === 'https://signed.example.com/our-bread.jpg',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('omits the hero when the user has disabled images', async () => {
    useStore
      .getState()
      .setUserPreference('u1', { showShoppingListImages: false });
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            item: {
              __typename: 'Item',
              id: 'i1',
              imageUrl: 'https://cdn.example.com/bread.jpg',
              photos: [],
            },
          }),
        ),
      ],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getAllByText('Bread')[0]).toBeTruthy();
    expect(screen.queryByTestId('shopping-item-hero-image')).toBeNull();
  });

  it('omits the hero when no image is available', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getAllByText('Bread')[0]).toBeTruthy();
    expect(screen.queryByTestId('shopping-item-hero-image')).toBeNull();
  });

  it('collapses the hero when its image fails to load', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            item: {
              __typename: 'Item',
              id: 'i1',
              imageUrl: 'https://cdn.example.com/broken.jpg',
              photos: [],
            },
          }),
        ),
      ],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getAllByText('Bread')[0]).toBeTruthy();
    // A photo that cannot load drops the hero, not a broken placeholder. The
    // native load is the boundary: the image reports it as `CachedImage` does.
    fireEvent(screen.UNSAFE_getByType(CachedImage), 'error');
    expect(screen.queryByTestId('shopping-item-hero-image')).toBeNull();
  });

  it("offers to report a public catalog item's photo", async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            item: {
              __typename: 'Item',
              id: 'i1',
              canSuggest: true,
              imageUrl: 'https://cdn.test/bread.jpg',
              photos: [],
            },
          }),
        ),
      ],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(
      screen.getByTestId('shopping-item-report-photo-button'),
    ).toBeTruthy();
  });

  // The hero photo carries no label: the flag says the user's upload awaits
  // review, and explains rather than reporting it.
  it("marks the flag over the user's photo awaiting review", async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [
        buildItemMock(
          'si1',
          buildShoppingListItem({
            item: {
              __typename: 'Item',
              id: 'i1',
              canSuggest: true,
              imageUrl: 'https://cdn.test/bread.jpg',
              photos: [
                {
                  __typename: 'ItemPhoto',
                  id: 'mine',
                  url: 'https://cdn.test/mine.jpg',
                  status: ItemImageStatus.Pending,
                },
              ],
            },
          }),
        ),
      ],
    });
    await log.landed(GetShoppingListItemDocument);
    const flag = screen.getByLabelText(t('itemPhotos.pendingReviewAction'));

    fireEvent.press(flag);

    expect(toastService.info).toHaveBeenCalledWith(
      t('itemPhotos.pendingReviewBody'),
    );
  });

  it('offers no photo report on a line with no catalog item', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', buildShoppingListItem())],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getAllByText('Bread')[0]).toBeTruthy();
    expect(
      screen.queryByTestId('shopping-item-report-photo-button'),
    ).toBeNull();
  });

  it('says a line the server holds nothing for is not found', async () => {
    renderWithApollo(<ShoppingListItemDetail route={route} />, {
      links: [log.link],
      operationMocks: [buildItemMock('si1', null)],
    });
    await log.landed(GetShoppingListItemDocument);
    expect(screen.getByText('Item not found')).toBeTruthy();
  });

  // The list's row caches a subset of what the detail selects, so the detail's
  // own query is an incomplete cache read until it has answered once. Known
  // offline, the real `offlineReadLink` answers that miss with `data: null`;
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
          log.link,
          createOfflineReadLink(),
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

        await log.landed(GetShoppingListItemDocument);
        expect(screen.getByText('Bakery')).toBeTruthy();
        expect(screen.getAllByText('Bread')[0]).toBeTruthy();
        expect(screen.getByText('Get whole wheat')).toBeTruthy();
        expect(screen.queryByTestId(kitTestIDs.stateLoading)).toBeNull();
        expect(screen.queryByText('Item not found')).toBeNull();
      },
    );

    it('claims nothing the row does not hold', async () => {
      await renderDetail({ listCached: true, network: 'offline' });

      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByText('Bakery')).toBeTruthy();
      expect(screen.getByTestId(shoppingListTestIDs.itemPartial)).toBeTruthy();
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

      expect(screen.getByText('Bakery')).toBeTruthy();
      expect(screen.queryByText('Item not found')).toBeNull();
      expect(noSuchLine.fired).toHaveLength(0);
    });

    it('fills in the detail-only fields when the network answers', async () => {
      await renderDetail({ listCached: true, network: 'online' });

      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByText('Costco')).toBeTruthy();
      expect(screen.getByText('Bakery')).toBeTruthy();
    });

    it('says a line the server has removed is not found, cached or not', async () => {
      await renderDetail({
        listCached: true,
        network: 'online',
        detail: recordMock(GetShoppingListItemDocument, {
          data: { shoppingListItem: null },
        }).mock,
      });
      await log.landed(GetShoppingListItemDocument);

      expect(screen.getByText('Item not found')).toBeTruthy();
    });

    it('online, waits for the rest of a cached row without calling it partial', async () => {
      await renderDetail({
        listCached: true,
        network: 'online',
        detail: recordMock(GetShoppingListItemDocument, { held: true }).mock,
      });
      await log.requested(GetShoppingListItemDocument);

      expect(screen.getByText('Bakery')).toBeTruthy();
      expect(screen.queryByTestId(shoppingListTestIDs.itemPartial)).toBeNull();
    });

    it('reports an offline cache miss as offline', async () => {
      await renderDetail({ listCached: false, network: 'offline' });

      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByTestId(kitTestIDs.stateOffline)).toBeTruthy();
      expect(screen.queryByText('Item not found')).toBeNull();
    });

    it('loads the detail on retry once the connection is back', async () => {
      await renderDetail({ listCached: false, network: 'offline' });
      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByTestId(kitTestIDs.stateOffline)).toBeTruthy();

      act(() => {
        useStore.setState({ isOnline: true, apiReachable: true });
      });
      fireEvent.press(screen.getByText('Try again'));

      await log.landed(GetShoppingListItemDocument, 2);
      expect(screen.getByText('Costco')).toBeTruthy();
    });

    it('reports a failed fetch with nothing cached, not a spinner', async () => {
      await renderDetail({ listCached: false, network: 'failing' });

      await log.landed(GetShoppingListItemDocument);
      expect(screen.getByTestId(kitTestIDs.stateError)).toBeTruthy();
      expect(screen.queryByTestId(kitTestIDs.stateLoading)).toBeNull();
    });
  });
});
