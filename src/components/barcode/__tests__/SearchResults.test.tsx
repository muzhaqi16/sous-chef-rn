'use no memo';
import React from 'react';
import { screen } from '@testing-library/react-native';
import { SearchResults, type SearchResultsProps } from '../SearchResults';
import { renderWithProviders } from '../../../../__tests__/helpers/renderWithProviders';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'CreatePantryItem') return [jest.fn(), { loading: false }];
    if (opName === 'RestockPantryItem') return [jest.fn(), { loading: false }];
    if (opName === 'AddItemToShoppingList')
      return [jest.fn(), { loading: false }];
    return [jest.fn(), {}];
  }),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  addNewItemToShoppingListCache: jest.fn(),
}));

jest.mock('#/utils/errors/pantryItemDuplicate', () => ({
  isPantryItemDuplicateError: jest.fn(() => false),
  getPantryItemDuplicateInfo: jest.fn(() => null),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) => {
    const state = { setPendingPantryScrollToTop: jest.fn() };
    return selector(state);
  }),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('../ItemCard', () => ({
  ItemCard: ({ item }: any) => {
    const { Text } = require('react-native');
    return require('react').createElement(Text, null, item.name);
  },
}));

jest.mock('../ActionButtons', () => ({
  ActionButtons: ({ primaryAction, secondaryAction }: any) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.View,
      null,
      R.createElement(
        RN.Pressable,
        { onPress: primaryAction.onPress, testID: 'primary-btn' },
        R.createElement(RN.Text, null, primaryAction.label),
      ),
      R.createElement(
        RN.Pressable,
        { onPress: secondaryAction.onPress, testID: 'secondary-btn' },
        R.createElement(RN.Text, null, secondaryAction.label),
      ),
    );
  },
}));

describe('SearchResults', () => {
  const mockItem = {
    id: 'item-1',
    name: 'Organic Milk',
    upc: '123456',
    netWeight: 1,
  };

  const defaultProps: SearchResultsProps = {
    item: mockItem,
    onScanAnother: jest.fn(),
    source: 'pantry',
    pantryId: 'pantry-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders item name', () => {
    renderWithProviders(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Organic Milk')).toBeTruthy();
  });

  it('renders Add to Pantry button for pantry source', () => {
    renderWithProviders(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Add to Pantry')).toBeTruthy();
  });

  it('renders Add to Shopping List button for shopping list source', () => {
    renderWithProviders(
      <SearchResults
        {...defaultProps}
        source="shoppingList"
        shoppingListId="list-1"
      />,
    );
    expect(screen.getByText('Add to Shopping List')).toBeTruthy();
  });

  it('renders Scan Another button', () => {
    renderWithProviders(<SearchResults {...defaultProps} />);
    expect(screen.getByText('Scan Another')).toBeTruthy();
  });

  it('renders Add Item when no source', () => {
    renderWithProviders(<SearchResults {...defaultProps} source={undefined} />);
    expect(screen.getByText('Add Item')).toBeTruthy();
  });
});
