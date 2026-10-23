import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { DisplayIngredient } from '#features/recipes/hooks/useRecipeData';
import { IngredientRow } from '../IngredientRow';

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: ({ uri }: { uri: string }) => {
    const { Text: RNText } = require('react-native');
    return require('react').createElement(RNText, null, `image-${uri}`);
  },
}));

const ingredient = (
  quantity: number,
  symbol: string | null,
  overrides: Partial<DisplayIngredient> = {},
): DisplayIngredient => ({
  __typename: 'RecipeIngredient',
  id: 'ingredient-1',
  name: 'monk fruit extract',
  quantity,
  originalText: null,
  estimatedPrice: null,
  image: null,
  isOptional: false,
  notes: null,
  preparation: null,
  sortOrder: 0,
  section: null,
  item: null,
  unit: symbol
    ? { __typename: 'Unit', id: `unit-${symbol}`, name: symbol, symbol }
    : null,
  convertedQuantity: null,
  ...overrides,
});

const renderRow = (value: DisplayIngredient) =>
  render(
    <IngredientRow ingredient={value} isAdded={false} onAdd={jest.fn()} />,
  );

describe('IngredientRow', () => {
  it('rounds an amount to three decimals', () => {
    renderRow(ingredient(177.4412, 'ml'));
    expect(screen.getByText('177.441 ml')).toBeTruthy();
  });

  it('shows a cooking fraction where one fits', () => {
    renderRow(ingredient(1.25, 'cup'));
    expect(screen.getByText('1 1/4 cup')).toBeTruthy();
  });

  it('shows only the name for an unmeasured ingredient', () => {
    renderRow(ingredient(0, null));
    expect(screen.getByText('monk fruit extract')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it("shows the server's conversion in the reader's own system", () => {
    renderRow(
      ingredient(1, 'cup', {
        convertedQuantity: {
          __typename: 'ConvertedValue',
          value: 236.588,
          unit: { __typename: 'Unit', id: 'unit-ml', symbol: 'ml' },
        },
      }),
    );
    expect(screen.getByText('236.588 ml')).toBeTruthy();
  });

  it('shows an estimated price beside the amount once the recipe has one', () => {
    renderRow(ingredient(1, 'cup', { estimatedPrice: 1.5 }));
    expect(screen.getByText(/^1 cup · .*1\.50/)).toBeTruthy();
  });

  it("shows the catalog item's photo when the ingredient has none", () => {
    renderRow(
      ingredient(1, 'cup', {
        item: {
          __typename: 'Item',
          id: 'item-1',
          name: 'Monk fruit',
          imageUrl: 'https://example.com/item.jpg',
        },
      }),
    );
    expect(screen.getByText('image-https://example.com/item.jpg')).toBeTruthy();
  });

  it('shows no picture without a photo', () => {
    renderRow(ingredient(1, 'cup'));
    expect(screen.queryByText(/^image-/)).toBeNull();
  });
});
