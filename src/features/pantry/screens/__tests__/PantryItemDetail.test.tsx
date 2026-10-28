'use no memo';

import React from 'react';
import { t } from '#/i18n';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { kitTestIDs } from '#components/testIDs';
import { catalogTestIDs } from '#features/catalog/testIDs';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import type {
  MockDataFor,
  QueryDataFor,
} from '#/test-utils/apolloMockProvider';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { GetPantryItemBatchesDocument } from '#features/pantry/graphql/pantry.generated';
import { GetPantryItemDocument } from '../usePantryItemDetailData.generated';
import {
  BatchStatus,
  EntryImageSource,
  ExternalSource,
  ItemImageStatus,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import type { ItemRecipeSuggestion } from '#features/pantry/hooks/useRecipeSuggestionsForItem';
import {
  pantryItemData,
  type PantryItemFixture,
} from '../../../../../__tests__/helpers/fixtures/pantryItemFixtures';

type ItemPhotoFixture = NonNullable<PantryItemFixture['photos']>[number];
import { PantryItemDetail } from '../PantryItemDetail';
import { toDateKey, todayKey } from '#/utils/dateUtils';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';

// The cost rows' own on/off cases live in PantryDetailInfo's suite.
jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(() => true),
}));

// Recipe-suggestions hook is its own concern (covered by
// useRecipeSuggestionsForItem.test). Mock it so this integration test
// doesn't need its query's mocks too.
const mockSuggestedRecipes: ItemRecipeSuggestion[] = [];
jest.mock('#features/pantry/hooks/useRecipeSuggestionsForItem', () => ({
  useRecipeSuggestionsForItem: () => ({
    suggestedRecipes: mockSuggestedRecipes,
    loadingRecipes: false,
  }),
}));

/** A header action, in the bar or in the "more" menu it overflowed into. */
const headerAction = (testID: string) => {
  const more = screen.queryByTestId(kitTestIDs.headerMoreButton);
  if (more) fireEvent.press(more);
  return screen.queryByTestId(testID);
};

// Action handlers are covered by usePantryItemDetailActions.test. Mock to
// expose stable refs for the screen's headerActions wiring.
jest.mock('#features/pantry/hooks/usePantryItemDetailActions', () => ({
  usePantryItemDetailActions: () => ({
    addToListStatus: 'idle',
    adjustModalVisible: false,
    setAdjustModalVisible: jest.fn(),
    correctingBatchId: null,
    setCorrectingBatchId: jest.fn(),
    handleDelete: jest.fn(),
    handleAddToShoppingList: jest.fn(),
    handleDiscardExpired: jest.fn(),
    handleConfirmAdjust: jest.fn(),
    handleCorrectPackageSize: jest.fn(),
  }),
}));

const mockToRecipeDetail = jest.fn();
const mockReplaceWithPantryItemDetail = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    goBack: jest.fn(),
    navigateTo: { pantryItem: jest.fn(), nutritionScreen: jest.fn() },
    navigate: jest.fn(),
    toRecipeDetail: mockToRecipeDetail,
    replaceWithPantryItemDetail: mockReplaceWithPantryItemDetail,
  }),
}));

const FULL_PERMISSIONS = {
  canAddItems: true,
  canEditItems: true,
  canRemoveItems: true,
};
const mockPermissions = { ...FULL_PERMISSIONS };
jest.mock('#features/pantry/hooks/usePantryPermissions', () => ({
  usePantryPermissions: () => mockPermissions,
}));

jest.mock('#hooks/performance/useScreenTransition', () => ({
  useScreenTransition: jest.fn(),
}));

jest.mock('#store/useAppStore', () => ({
  useSelectedShoppingListId: jest.fn(() => 'sl-1'),
  useSelectedPantryId: jest.fn(() => 'p1'),
  useSelectedHomeId: jest.fn(() => 'home-1'),
  useIsOnline: jest.fn(() => true),
  // The screen classifies its own data state via useDataState ->
  // useOfflineAwareError -> useIsApiUnavailable, which calls
  // useAppStore(selector). Online by default; individual tests override.
  useAppStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector({ isOnline: true, isApiUnavailable: false }),
  ),
}));

jest.mock('#components/organisms/Header', () => ({
  Header: ({ rightActions }: { rightActions?: HeaderAction[] }) => {
    const { View } = require('react-native');
    return (
      <View testID="header">
        {(rightActions ?? []).map((a, i) => (
          <View key={i} testID={a.testID} />
        ))}
      </View>
    );
  },
}));

jest.mock('#features/catalog/ui/ItemPhotoCarousel', () => ({
  ItemPhotoCarousel: () => null,
}));

jest.mock('#features/pantry/components/modals/AdjustQuantityModal', () => ({
  AdjustQuantityModal: () => null,
}));

jest.mock('#features/pantry/components/modals/CorrectPackageSizeModal', () => ({
  CorrectPackageSizeModal: () => null,
}));

jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => null,
}));

// The offline predicate `useDataState` consults. Mocked at the hook rather than
// the slice so the test does not depend on networkSlice internals.
const mockBlocksCacheMissQueries = jest.fn(() => false);
jest.mock('#hooks/app/useIsApiUnavailable', () => ({
  useIsApiUnavailable: () => mockBlocksCacheMissQueries(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockPermissions, FULL_PERMISSIONS);
  mockSuggestedRecipes.length = 0;
});

const route = { params: { itemId: 'pi1' } };

function itemMock(fixture: PantryItemFixture = {}) {
  return recordMock(GetPantryItemDocument, {
    data: pantryItemData(fixture),
  }).mock;
}

/**
 * The batch query the screen fires alongside the item. Its costs are what the
 * detail header shows: a restock adds a batch and the server recomputes only
 * `PantryItem.quantity`, leaving the item's own cost fields on the first stock.
 */
function batchesMock(
  batches: Array<{
    id: string;
    quantity: number;
    costPerUnit: number | null;
    totalCost?: number | null;
    createdAt?: string;
  }>,
) {
  const data: MockDataFor<typeof GetPantryItemBatchesDocument> = {
    pantryItemBatchesConnection: {
      __typename: 'PantryItemBatchConnection',
      edges: batches.map((b, index) => ({
        __typename: 'PantryItemBatchEdge',
        node: {
          __typename: 'PantryItemBatch',
          id: b.id,
          batchNumber: index + 1,
          quantity: b.quantity,
          status: BatchStatus.Active,
          costPerUnit: b.costPerUnit,
          totalCost: b.totalCost ?? null,
          createdAt: b.createdAt ?? '2026-08-01T00:00:00Z',
        },
      })),
    },
  };
  return recordMock(GetPantryItemBatchesDocument, {
    data,
  }).mock;
}

const fullItem: PantryItemFixture = {
  itemName: 'Milk',
  quantity: 2,
  storageState: 'REFRIGERATED',
  brandName: 'Organic Valley',
  categoryName: 'Dairy',
  storageNotes: 'Keep cold',
  tags: ['organic', 'dairy'],
};

describe('PantryItemDetail (integration)', () => {
  describe('cost after a restock', () => {
    // The server now values the REMAINING stock: 5 @ $0.59 plus 3 @ $1.00 is
    // $5.95 over 8 units. The screen renders those, and reads the batches only
    // to decide the labels.
    const restocked: PantryItemFixture = {
      ...fullItem,
      quantity: 8,
      costPerUnit: 0.74,
      totalCost: 5.95,
    };

    it('labels the server rate as an average and names the last purchase', async () => {
      renderWithApollo(<PantryItemDetail route={route} />, {
        operationMocks: [
          itemMock(restocked),
          batchesMock([
            { id: 'b1', quantity: 5, costPerUnit: 0.59, totalCost: 2.95 },
            {
              id: 'b2',
              quantity: 3,
              costPerUnit: 1,
              totalCost: 3,
              createdAt: '2026-08-31T00:00:00Z',
            },
          ]),
        ],
      });

      expect(await screen.findByText('Avg Cost/Unit')).toBeTruthy();
      expect(screen.getByText('$0.74')).toBeTruthy();
      expect(screen.getByText('Stock value')).toBeTruthy();
      expect(screen.getByText('$5.95')).toBeTruthy();
      expect(screen.getByText('Last purchase')).toBeTruthy();
    });

    it('leaves a single-batch item reading plainly', async () => {
      renderWithApollo(<PantryItemDetail route={route} />, {
        operationMocks: [
          itemMock({
            ...fullItem,
            quantity: 5,
            costPerUnit: 0.59,
            totalCost: 2.95,
          }),
          batchesMock([
            { id: 'b1', quantity: 5, costPerUnit: 0.59, totalCost: 2.95 },
          ]),
        ],
      });

      expect(await screen.findByText('Cost/Unit')).toBeTruthy();
      expect(screen.getByText('$0.59')).toBeTruthy();
      expect(screen.getByText('$2.95')).toBeTruthy();
      expect(screen.queryByText('Avg Cost/Unit')).toBeNull();
    });

    it('hides a rate diluted by stock with no recorded cost', async () => {
      renderWithApollo(<PantryItemDetail route={route} />, {
        operationMocks: [
          // The server spread $2.95 of known cost over all 8 units.
          itemMock({
            ...fullItem,
            quantity: 8,
            costPerUnit: 0.37,
            totalCost: 2.95,
          }),
          batchesMock([
            { id: 'paid', quantity: 5, costPerUnit: 0.59, totalCost: 2.95 },
            { id: 'gifted', quantity: 3, costPerUnit: null },
          ]),
        ],
      });

      expect(await screen.findByText('Stock value')).toBeTruthy();
      expect(screen.queryByText('Cost/Unit')).toBeNull();
      expect(screen.queryByText('$0.37')).toBeNull();
    });

    it('omits both money rows when nothing left has a known cost', async () => {
      renderWithApollo(<PantryItemDetail route={route} />, {
        operationMocks: [
          itemMock({ ...fullItem, costPerUnit: null, totalCost: null }),
          batchesMock([{ id: 'b1', quantity: 5, costPerUnit: null }]),
        ],
      });

      await screen.findAllByText('Milk');
      expect(screen.queryByText('Cost/Unit')).toBeNull();
      expect(screen.queryByText('Stock value')).toBeNull();
      expect(screen.queryByText('$0.00')).toBeNull();
    });
  });

  it('renders the item name', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findAllByText('Milk');
  });

  it('renders a fractional quantity as a cooking fraction', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({
          ...fullItem,
          quantity: 1.25,
          unitSymbol: 'cup',
          unitDisplayAsFraction: true,
        }),
      ],
    });
    expect(await screen.findAllByText('1 1/4 cup')).toHaveLength(3);
  });

  it('keeps decimals, rounded to three places, for a unit that opts out of fractions', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock({ ...fullItem, quantity: 177.4412 })],
    });
    expect(await screen.findAllByText('177.441 L')).toHaveLength(3);
  });

  it('shows the category and storage state', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findByText(/Dairy/);
    expect(screen.getByText(/Fridge/)).toBeTruthy();
  });

  it('shows brand info row', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findByText('Organic Valley');
  });

  it('shows notes section', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findByText('Keep cold');
  });

  it('shows tags section', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findByText('organic');
    expect(screen.getByText('dairy')).toBeTruthy();
  });

  it('shows recipes section heading', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findByText('Recipes to try');
  });

  it('opens a suggested catalog recipe with what its card shows', async () => {
    mockSuggestedRecipes.push({
      __typename: 'CatalogRecipeHit',
      provider: ExternalSource.Spoonacular,
      providerRecipeId: '42',
      name: 'Tomato soup',
      imageUrl: 'https://img.example.com/42.jpg',
      totalTimeMinutes: 20,
      servings: 4,
    });
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });

    fireEvent.press(await screen.findByText('Tomato soup'));

    expect(mockToRecipeDetail).toHaveBeenCalledWith({
      catalog: {
        provider: ExternalSource.Spoonacular,
        externalId: '42',
        name: 'Tomato soup',
        imageUrl: 'https://img.example.com/42.jpg',
      },
    });
  });

  // The server's EXPIRED flag can be a day late east of UTC; the date decides.
  it("offers discard once the batches' expiry date has passed, flag or not", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({
          ...fullItem,
          expiresOn: toDateKey(yesterday),
          earliestBatchExpiresOn: toDateKey(yesterday),
        }),
      ],
    });
    await screen.findAllByText('Milk');
    expect(headerAction('pantry-item-discard-button')).toBeTruthy();
  });

  it('does not offer discard on the expiry date itself', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({
          ...fullItem,
          expiresOn: todayKey(),
          earliestBatchExpiresOn: todayKey(),
        }),
      ],
    });
    await screen.findAllByText('Milk');
    expect(screen.queryByTestId('pantry-item-discard-button')).toBeNull();
  });

  // An edit moves only the item's date; the server would find no expired batch.
  it('does not offer discard for an item date its batches do not share', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({ ...fullItem, expiresOn: toDateKey(yesterday) }),
      ],
    });
    await screen.findAllByText('Milk');
    expect(screen.queryByTestId('pantry-item-discard-button')).toBeNull();
  });

  // The API gates delete and discard on `canRemoveItems`, which a member lacks
  // by default: offering them to one who may only edit ends in a refusal.
  it('offers edit but neither delete nor discard to a member who may not remove', async () => {
    Object.assign(mockPermissions, { canRemoveItems: false });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({
          ...fullItem,
          expiresOn: toDateKey(yesterday),
          earliestBatchExpiresOn: toDateKey(yesterday),
        }),
      ],
    });
    await screen.findAllByText('Milk');
    expect(headerAction('pantry-item-edit-button')).toBeTruthy();
    expect(screen.getByTestId('pantry-item-adjust-button')).toBeTruthy();
    expect(screen.queryByTestId('pantry-item-delete-button')).toBeNull();
    expect(screen.queryByTestId('pantry-item-discard-button')).toBeNull();
  });

  it('renders header action buttons when permissions are granted', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findAllByText('Milk');
    // Add to list and adjust stay in the bar; the rest open from "more".
    expect(screen.getByTestId('pantry-item-add-to-list-button')).toBeTruthy();
    expect(screen.getByTestId('pantry-item-adjust-button')).toBeTruthy();
    expect(headerAction('pantry-item-edit-button')).toBeTruthy();
    expect(headerAction('pantry-item-delete-button')).toBeTruthy();
  });

  it("offers to report a public catalog item's photo", async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({
          ...fullItem,
          canSuggest: true,
          imageUrl: 'https://cdn.test/milk.jpg',
        }),
      ],
    });
    await screen.findAllByText('Milk');
    expect(headerAction('pantry-item-report-photo-button')).toBeTruthy();
  });

  // The household's own upload is nobody else's to review.
  it("offers no photo report over the household's own upload", async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({
          ...fullItem,
          canSuggest: true,
          imageUrl: 'https://cdn.test/milk.jpg',
          image: {
            __typename: 'EntryImage',
            url: 'https://signed.test/own.jpg',
            source: EntryImageSource.Household,
            catalogImageId: null,
          },
        }),
      ],
    });
    await screen.findAllByText('Milk');
    expect(headerAction('pantry-item-report-photo-button')).toBeNull();
  });

  it('offers the household a photo of its own to a member who can edit', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findAllByText('Milk');
    expect(headerAction('entry-photo-change-button')).toBeTruthy();
  });

  it('offers no photo change to a member who cannot edit', async () => {
    Object.assign(mockPermissions, { canEditItems: false });
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findAllByText('Milk');
    expect(headerAction('entry-photo-change-button')).toBeNull();
  });

  describe('picking one of the item photos', () => {
    const photo = (id: string): ItemPhotoFixture => ({
      __typename: 'ItemPhoto',
      id,
      url: `https://cdn.test/${id}.jpg`,
      perspective: null,
      isPrimary: false,
      status: ItemImageStatus.Approved,
      credit: null,
      variants: [],
    });
    const pickOffered = async (fixture: Partial<typeof fullItem>) => {
      renderWithApollo(<PantryItemDetail route={route} />, {
        operationMocks: [itemMock({ ...fullItem, ...fixture })],
      });
      await screen.findAllByText('Milk');
      const change = headerAction(catalogTestIDs.entryPhotoChangeButton);
      if (change) fireEvent.press(change);
      await screen.findByTestId(catalogTestIDs.entryPhotoSheet);
      return screen.queryByTestId(catalogTestIDs.entryPhotoPickItemPhoto);
    };

    it('is offered while there is a photo other than the one in use', async () => {
      expect(
        await pickOffered({
          photos: [photo('front'), photo('back')],
          image: {
            __typename: 'EntryImage',
            url: 'https://cdn.test/front.jpg',
            source: EntryImageSource.Household,
            catalogImageId: 'front',
          },
        }),
      ).toBeTruthy();
    });

    // The viewer offers "Use this photo" on every photo but the one in use.
    it('is not offered when the only photo is already in use', async () => {
      expect(
        await pickOffered({
          photos: [photo('front')],
          image: {
            __typename: 'EntryImage',
            url: 'https://cdn.test/front.jpg',
            source: EntryImageSource.Household,
            catalogImageId: 'front',
          },
        }),
      ).toBeNull();
    });
  });

  it('offers "Not this item?" to a member who can edit', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findAllByText('Milk');
    expect(headerAction('pantry-item-relink-button')).toBeTruthy();
  });

  it('offers no "Not this item?" to a member who cannot edit', async () => {
    Object.assign(mockPermissions, { canEditItems: false });
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findAllByText('Milk');
    expect(headerAction('pantry-item-relink-button')).toBeNull();
  });

  it('offers no photo report on an item with no photo', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock({ ...fullItem, canSuggest: true })],
    });
    await screen.findAllByText('Milk');
    expect(headerAction('pantry-item-report-photo-button')).toBeNull();
  });

  it('shows the offline state, not a spinner, on an offline cache miss', async () => {
    // The screen read only `data` from useQuery and rendered a bare loader
    // whenever `item` was falsy, so offline it span forever with no error and
    // no retry. `loading` and `error` were never consulted.
    mockBlocksCacheMissQueries.mockReturnValue(true);

    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        recordMock(GetPantryItemDocument, {
          error: new Error('offline: no cached data'),
        }).mock,
      ],
    });

    expect(await screen.findByTestId('state-offline')).toBeTruthy();
    expect(screen.queryByTestId('state-loading')).toBeNull();
  });

  it('says a stack the server holds nothing for is gone, not that it failed to load', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        recordMock(GetPantryItemDocument, { data: { pantryItem: null } }).mock,
      ],
    });

    expect(await screen.findByTestId('pantry-item-removed')).toBeTruthy();
    expect(
      screen.getByText('This item is no longer in your pantry'),
    ).toBeTruthy();
    expect(screen.getByText('Go Back')).toBeTruthy();
    expect(screen.queryByTestId('state-error')).toBeNull();
    expect(screen.queryByTestId('state-loading')).toBeNull();
  });

  it('renders loader before the query resolves', () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        recordMock(GetPantryItemDocument, {
          data: pantryItemData(fullItem),
          held: true,
        }).mock,
      ],
    });
    expect(screen.getByTestId('pantry-item-detail')).toBeTruthy();
    expect(screen.queryByText('Milk')).toBeNull();
  });

  it("renders the item's nutritionFacts in the nutrition section", async () => {
    // Read as nested `{ amount, unit }` objects, the flat `Item.nutritions`
    // Json yields no amount, and the section never renders.
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({
          ...fullItem,
          nutritionFacts: {
            __typename: 'NutritionFacts',
            id: 'nf1',
            calories: 64,
            totalFat: 3.6,
            saturatedFat: 2.3,
            transFat: null,
            cholesterol: 12,
            sodium: 44,
            totalCarbs: 4.8,
            dietaryFiber: null,
            totalSugars: 5.1,
            addedSugars: null,
            protein: 3.3,
            vitaminD: 1.3,
            calcium: 120,
            iron: null,
            potassium: 150,
            servingSize: 100,
            servingUnit: 'ml',
          },
        }),
      ],
    });
    expect(await screen.findByText('Nutrition')).toBeTruthy();
    expect(screen.getByText('64')).toBeTruthy();
    expect(screen.getByText('3.3')).toBeTruthy();
    expect(screen.getByText('4.8')).toBeTruthy();
    expect(screen.getByText('3.6')).toBeTruthy();
    expect(screen.getByText('Per 100 ml')).toBeTruthy();
  });

  // USM-3: a stack merged into another answers as the survivor, which takes
  // this screen's place.
  it('shows the survivor in place of a stack merged into it', async () => {
    renderWithApollo(
      <PantryItemDetail route={{ params: { itemId: 'pi-merged' } }} />,
      { operationMocks: [itemMock(fullItem)] },
    );

    await waitFor(() =>
      expect(mockReplaceWithPantryItemDetail).toHaveBeenCalledWith({
        itemId: 'pi1',
      }),
    );
  });

  it('stays put when the answer is the stack it asked for', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });

    await screen.findAllByText('Milk');
    expect(mockReplaceWithPantryItemDetail).not.toHaveBeenCalled();
  });

  // A product whose record states none reads its concept's values: titled as
  // typical, and making no health claim for the product.
  it("titles a concept's values as typical, with no highlights", async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({
          ...fullItem,
          nutritionFacts: {
            __typename: 'NutritionFacts',
            id: 'nf-concept',
            calories: 334,
            totalFat: 1.1,
            saturatedFat: null,
            transFat: null,
            cholesterol: null,
            sodium: null,
            totalCarbs: 70,
            dietaryFiber: null,
            totalSugars: null,
            addedSugars: null,
            protein: 10.3,
            vitaminD: null,
            calcium: null,
            iron: null,
            potassium: null,
            servingSize: 100,
            servingUnit: 'g',
          },
          typicalOf: 'flour',
        }),
      ],
    });
    expect(
      await screen.findByText(t('labels.typicalFor', { concept: 'flour' })),
    ).toBeTruthy();
    expect(screen.getByText('334')).toBeTruthy();
    expect(screen.queryByText('Nutrition')).toBeNull();
    expect(screen.queryByText(t('recipes.healthGoal.HIGH_PROTEIN'))).toBeNull();
    expect(screen.queryByText(t('nutritionHighlights.lowFat'))).toBeNull();
  });

  it('hides nutrition section when item has no nutrition data', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findAllByText('Milk');
    expect(screen.queryByText('Nutrition')).toBeNull();
  });

  it('omits storage location text when item has none', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        itemMock({
          ...fullItem,
          storageLocationName: null,
        }),
      ],
    });
    await screen.findAllByText('Milk');
  });

  // The weights read in the user's unit system by the API's own readings,
  // whatever unit the stack stores them in.
  describe('weights in the user\u2019s unit system', () => {
    type PackageSizeData = NonNullable<
      NonNullable<
        QueryDataFor<typeof GetPantryItemDocument>['pantryItem']
      >['packageSize']
    >;
    interface ReadingUnit {
      id: string;
      symbol: string;
      type: UnitType;
    }

    const unit = (
      id: string,
      symbol: string,
      type = UnitType.Weight,
    ): ReadingUnit => ({ id, symbol, type });
    const read = ([value, { id, symbol, type }]: [
      number,
      ReadingUnit,
    ]): PackageSizeData['metric'] =>
      readingAsAbbreviation({
        __typename: 'MeasureReading',
        value,
        unitId: id,
        symbol,
        displayAsFraction: false,
        type,
      });
    const g = unit('unit-g', 'g');
    const oz = unit('unit-oz', 'oz');
    const kg = unit('unit-kg', 'kg');
    const lb = unit('unit-lb', 'lb');

    const measure = (
      value: number,
      stored: ReadingUnit,
      metric: [number, ReadingUnit],
      imperial: [number, ReadingUnit],
    ): PackageSizeData => ({
      __typename: 'Measure',
      value,
      unitId: stored.id,
      metric: read(metric),
      imperial: read(imperial),
    });

    /** A stack whose package size is stored as `value` `stored`. */
    const weighed = (
      value: number,
      stored: ReadingUnit,
      remaining?: number,
    ) => {
      const data = pantryItemData(fullItem);
      const item = data.pantryItem;
      if (!item) throw new Error('fixture has no item');
      item.netWeight = value;
      item.netWeightUnit = asAbbreviation({
        __typename: 'Unit',
        id: stored.id,
        name: stored.symbol,
        symbol: stored.symbol,
      });
      item.packageSize = measure(value, stored, [1.36, kg], [3, lb]);
      if (remaining !== undefined) {
        item.remainingNetWeight = remaining;
        item.remaining = measure(remaining, stored, [940, g], [2.07, lb]);
      }
      return recordMock(GetPantryItemDocument, { data }).mock;
    };

    const settings = (preferredUnitSystem: UnitSystem) =>
      recordMock(GetUserSettingsDocument, {
        data: {
          me: {
            __typename: 'User',
            id: 'user-1',
            settings: {
              __typename: 'UserSettings',
              id: 'settings-1',
              preferredUnitSystem,
              deviceUnitSystem: UnitSystem.Imperial,
            },
          },
        },
      }).mock;

    it.each([
      ['grams', 1360.78, g],
      ['ounces', 48, oz],
    ])(
      'reads a package size stored in %s as pounds on an imperial device',
      async (_label, value, stored) => {
        renderWithApollo(<PantryItemDetail route={route} />, {
          operationMocks: [weighed(value, stored), settings(UnitSystem.System)],
        });
        expect(await screen.findByText('3 lb')).toBeTruthy();
      },
    );

    it('reads it in kilograms for a metric user', async () => {
      renderWithApollo(<PantryItemDetail route={route} />, {
        operationMocks: [weighed(1360.78, g), settings(UnitSystem.Metric)],
      });
      expect(await screen.findByText('1.36 kg')).toBeTruthy();
    });

    it('follows a change of setting at once, with no request for it', async () => {
      const cache = makeCache();
      writeUnitSystemSettings(cache, UnitSystem.Imperial, UnitSystem.Imperial);
      renderWithApollo(<PantryItemDetail route={route} />, {
        cache,
        operationMocks: [weighed(1360.78, g)],
      });
      expect(await screen.findByText('3 lb')).toBeTruthy();

      act(() => {
        cache.modify({
          id: 'UserSettings:settings-1',
          fields: { preferredUnitSystem: () => UnitSystem.Metric },
        });
      });

      expect(await screen.findByText('1.36 kg')).toBeTruthy();
    });

    it('reads what remains in the same system', async () => {
      renderWithApollo(<PantryItemDetail route={route} />, {
        operationMocks: [weighed(1360.78, g, 940), settings(UnitSystem.System)],
      });
      expect(await screen.findByText('2.07 lb')).toBeTruthy();
    });

    it('reads what it holds as the row does, not in stored grams', async () => {
      const data = pantryItemData({
        ...fullItem,
        quantity: 907.18,
        heldQuantity: 907.18,
        unitSymbol: 'g',
        unitName: 'gram',
      });
      const item = data.pantryItem;
      if (!item) throw new Error('fixture has no item');
      item.held = measure(907.18, g, [907.18, g], [2, lb]);
      item.held.unitId = item.unit.id;
      renderWithApollo(<PantryItemDetail route={route} />, {
        operationMocks: [
          recordMock(GetPantryItemDocument, { data }).mock,
          settings(UnitSystem.Imperial),
        ],
      });
      expect((await screen.findAllByText('2 lb')).length).toBeGreaterThan(0);
      expect(screen.queryByText('907.18 g')).toBeNull();
    });

    // A "6.35 oz (180 g)" can: the API reads each system in the label's own
    // figure, and the screen shows it as read, never a rounded 6.3 oz.
    it.each([
      [UnitSystem.Imperial, '6.35 oz'],
      [UnitSystem.Metric, '180 g'],
    ])('reads a declared can in %s as its label does', async (system, text) => {
      const data = pantryItemData(fullItem);
      const item = data.pantryItem;
      if (!item) throw new Error('fixture has no item');
      item.netWeight = 180;
      item.netWeightUnit = asAbbreviation({
        __typename: 'Unit',
        id: g.id,
        name: g.symbol,
        symbol: g.symbol,
      });
      item.packageSize = measure(180, g, [180, g], [6.35, oz]);
      renderWithApollo(<PantryItemDetail route={route} />, {
        operationMocks: [
          recordMock(GetPantryItemDocument, { data }).mock,
          settings(system),
        ],
      });
      expect(await screen.findByText(text)).toBeTruthy();
    });
  });
});
