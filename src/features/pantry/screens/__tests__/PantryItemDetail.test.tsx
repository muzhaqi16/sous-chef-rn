'use no memo';

import React from 'react';
import { screen } from '@testing-library/react-native';
import type { HeaderAction } from '#components/atoms/HeaderActionIcon';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  GetPantryItemBatchesDocument,
  GetPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { BatchStatus } from '#/graphql/generated/schemaTypes';
import {
  pantryItemData,
  type PantryItemFixture,
} from '../../../../../__tests__/helpers/fixtures/pantryItemFixtures';
import { PantryItemDetail } from '../PantryItemDetail';

// Recipe-suggestions hook is its own concern (covered by
// useRecipeSuggestionsForItem.test). Mock it so this integration test
// doesn't need to also mock Spoonacular.
jest.mock('#features/pantry/hooks/useRecipeSuggestionsForItem', () => ({
  useRecipeSuggestionsForItem: () => ({
    suggestedRecipes: [],
    loadingRecipes: false,
  }),
}));

// Action handlers are covered by usePantryItemDetailActions.test. Mock to
// expose stable refs for the screen's headerActions wiring.
jest.mock('#features/pantry/hooks/usePantryItemDetailActions', () => ({
  usePantryItemDetailActions: () => ({
    addToListStatus: 'idle',
    adjustModalVisible: false,
    setAdjustModalVisible: jest.fn(),
    correctWeightVisible: false,
    setCorrectWeightVisible: jest.fn(),
    handleDelete: jest.fn(),
    handleAddToShoppingList: jest.fn(),
    handleDiscardExpired: jest.fn(),
    handleConfirmAdjust: jest.fn(),
    handleCorrectWeight: jest.fn(),
  }),
}));

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    goBack: jest.fn(),
    navigateTo: { pantryItem: jest.fn(), nutritionScreen: jest.fn() },
    navigate: jest.fn(),
  }),
}));

jest.mock('#features/pantry/hooks/usePantryPermissions', () => ({
  usePantryPermissions: () => ({
    canAddItems: true,
    canEditItems: true,
  }),
}));

jest.mock('#hooks/performance/useScreenTransition', () => ({
  useScreenTransition: jest.fn(),
}));

jest.mock('#store/useAppStore', () => ({
  useSelectedShoppingListId: jest.fn(() => 'sl-1'),
  useSelectedPantryId: jest.fn(() => 'p1'),
  // The screen classifies its own data state via useDataState ->
  // useOfflineAwareError -> useBlocksCacheMissQueries, which calls
  // useAppStore(selector). Online by default; individual tests override.
  useAppStore: jest.fn((selector: (s: unknown) => unknown) =>
    selector({ isOnline: true, isApiUnavailable: false }),
  ),
}));

jest.mock('#components/molecules/Header', () => ({
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

jest.mock('#features/catalog/ui/NutritionSummary', () => ({
  NutritionSummary: () => null,
}));

jest.mock('#features/catalog/ui/ItemPhotoCarousel', () => ({
  ItemPhotoCarousel: () => null,
}));

jest.mock('#features/pantry/components/modals/AdjustQuantityModal', () => ({
  AdjustQuantityModal: () => null,
}));

jest.mock('#features/pantry/components/modals/CorrectWeightModal', () => ({
  CorrectWeightModal: () => null,
}));

jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => null,
}));

// The offline predicate `useDataState` consults. Mocked at the hook rather than
// the slice so the test does not depend on networkSlice internals.
const mockBlocksCacheMissQueries = jest.fn(() => false);
jest.mock('#hooks/app/useBlocksCacheMissQueries', () => ({
  useBlocksCacheMissQueries: () => mockBlocksCacheMissQueries(),
}));

beforeEach(() => {
  jest.clearAllMocks();
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
  return recordMock(GetPantryItemBatchesDocument, {
    data: {
      pantryItemBatchesConnection: {
        __typename: 'PantryItemBatchConnection' as const,
        edges: batches.map((b, index) => ({
          __typename: 'PantryItemBatchEdge' as const,
          node: {
            __typename: 'PantryItemBatch' as const,
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
    },
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

  it('renders header action buttons when permissions are granted', async () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [itemMock(fullItem)],
    });
    await screen.findAllByText('Milk');
    expect(screen.getByTestId('pantry-item-add-to-list-button')).toBeTruthy();
    expect(screen.getByTestId('pantry-item-edit-button')).toBeTruthy();
    expect(screen.getByTestId('pantry-item-delete-button')).toBeTruthy();
    expect(screen.getByTestId('pantry-item-adjust-button')).toBeTruthy();
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

  it('renders loader before the query resolves', () => {
    renderWithApollo(<PantryItemDetail route={route} />, {
      operationMocks: [
        recordMock(GetPantryItemDocument, {
          data: pantryItemData(fullItem),
          delay: 1000,
        }).mock,
      ],
    });
    expect(screen.getByTestId('pantry-item-detail')).toBeTruthy();
    expect(screen.queryByText('Milk')).toBeNull();
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
});
