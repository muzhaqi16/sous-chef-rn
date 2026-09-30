import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { DisplayIngredient } from '#features/recipes/hooks/useRecipeData';
import { IngredientCard } from '../IngredientCard';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const ingredient = (
  quantity: number,
  symbol: string | null,
  overrides: Partial<DisplayIngredient> = {},
): DisplayIngredient => ({
  __typename: 'RecipeIngredient',
  id: 'ingredient-1',
  name: 'monk fruit extract',
  quantity,
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

const renderCard = (value: DisplayIngredient) =>
  render(
    <IngredientCard ingredient={value} isAdded={false} onPress={jest.fn()} />,
  );

describe('IngredientCard quantity', () => {
  it('rounds an amount to three decimals', () => {
    renderCard(ingredient(177.4412, 'ml'));
    expect(screen.getByText('177.441 ml')).toBeTruthy();
  });

  it('shows a cooking fraction where one fits', () => {
    renderCard(ingredient(1.25, 'cup'));
    expect(screen.getByText('1 1/4 cup')).toBeTruthy();
  });

  it('shows no amount for an unmeasured ingredient', () => {
    renderCard(ingredient(0, null));
    expect(screen.queryByText('0')).toBeNull();
  });

  it("shows the server's conversion in the reader's own system", () => {
    renderCard(
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

  it('shows an estimated price once the recipe has one', () => {
    renderCard(ingredient(1, 'cup', { estimatedPrice: 1.5 }));
    expect(screen.getByText(/1\.50/)).toBeTruthy();
  });
});
