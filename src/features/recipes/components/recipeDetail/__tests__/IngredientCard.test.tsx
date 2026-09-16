import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { UnitSystem } from '#/graphql/generated/schemaTypes';
import type { RecipeIngredient } from '#/services/spoonacular/types';
import { IngredientCard } from '../IngredientCard';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const spoonacularIngredient = (
  amount: number,
  unitShort: string,
): RecipeIngredient => ({
  id: 1,
  aisle: 'Baking',
  image: '',
  consistency: 'SOLID',
  name: 'monk fruit extract',
  nameClean: 'monk fruit extract',
  original: '',
  originalName: 'monk fruit extract',
  amount,
  unit: unitShort,
  meta: [],
  measures: {
    metric: { amount, unitShort, unitLong: unitShort },
    us: { amount, unitShort, unitLong: unitShort },
  },
});

const renderCard = (ingredient: RecipeIngredient) =>
  render(
    <IngredientCard
      ingredient={ingredient}
      isAdded={false}
      onPress={jest.fn()}
      unitSystem={UnitSystem.Metric}
    />,
  );

describe('IngredientCard quantity', () => {
  it('rounds a converted amount to three decimals', () => {
    renderCard(spoonacularIngredient(177.4412, 'ml'));
    expect(screen.getByText('177.441 ml')).toBeTruthy();
  });

  it('shows a cooking fraction where one fits', () => {
    renderCard(spoonacularIngredient(1.25, 'cup'));
    expect(screen.getByText('1 1/4 cup')).toBeTruthy();
  });

  it('shows no amount for an unmeasured ingredient', () => {
    renderCard(spoonacularIngredient(0, ''));
    expect(screen.queryByText('0')).toBeNull();
  });
});
