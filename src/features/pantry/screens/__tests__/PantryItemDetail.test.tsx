'use no memo';

import React from 'react';
import { screen } from '@testing-library/react-native';
import type { HeaderAction } from '#components/atoms/HeaderActionIcon';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { GetPantryItemDocument } from '#features/pantry/graphql/pantry.generated';
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

jest.mock('#components/molecules/NutritionSummary', () => ({
  NutritionSummary: () => null,
}));

jest.mock('#components/molecules/ItemPhotoCarousel', () => ({
  ItemPhotoCarousel: () => null,
}));

jest.mock('#components/modals/AdjustQuantityModal', () => ({
  AdjustQuantityModal: () => null,
}));

jest.mock('#components/modals/CorrectWeightModal', () => ({
  CorrectWeightModal: () => null,
}));

jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => null,
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
