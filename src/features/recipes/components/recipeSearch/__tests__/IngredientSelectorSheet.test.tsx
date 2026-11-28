import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { pantryData } from '#/test-utils/fixtures/pantryFixtures';
import { t } from '#i18n';
import { IngredientSelectorSheet } from '../IngredientSelectorSheet';

// Nine items, so the sheet offers its search.
const PANTRY = pantryData({
  id: 'pantry-1',
  items: [
    'Apples',
    'Basil',
    'Carrots',
    'Dates',
    'Eggs',
    'Flour',
    'Garlic',
    'Honey',
    'Rice',
  ].map(itemName => ({ id: itemName, itemName })),
});
const SOURCE = {
  pantryItems: (PANTRY.pantry?.itemsConnection.edges ?? []).map(
    ({ node }) => node,
  ),
  pantryHasMore: false,
  loadMorePantryItems: jest.fn(),
  selectedIngredients: new Set<string>(),
  toggleIngredient: jest.fn(),
  clearSelectedIngredients: jest.fn(),
  handleIngredientSearch: jest.fn(() => Promise.resolve()),
};

const sheet = (visible: boolean) => (
  <IngredientSelectorSheet
    visible={visible}
    screen={SOURCE}
    onSheetChange={jest.fn()}
  />
);

const search = () =>
  screen.getByPlaceholderText(t('recipes.searchIngredientsPlaceholder'));
const snapTo = (index: number) =>
  fireEvent(screen.getByText(t('recipes.selectIngredients')), 'change', index);

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('IngredientSelectorSheet', () => {
  it('keeps its search through a snap change', async () => {
    renderWithApollo(sheet(true));
    fireEvent.changeText(search(), 'garl');
    await drainTimers();
    expect(screen.queryByText('Apples')).toBeNull();

    snapTo(2);
    await drainTimers();

    expect(screen.getByText('Garlic')).toBeOnTheScreen();
    expect(screen.queryByText('Apples')).toBeNull();
  });

  it('opens again with no search', async () => {
    const view = renderWithApollo(sheet(true));
    fireEvent.changeText(search(), 'garl');
    await drainTimers();

    view.rerender(sheet(false));
    await drainTimers();
    view.rerender(sheet(true));
    await drainTimers();

    expect(screen.getByText('Apples')).toBeOnTheScreen();
  });
});
