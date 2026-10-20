import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { IngredientFormState } from '#features/recipes/screens/RecipeForm/formState';
import { RecipeIngredientList } from '../RecipeIngredientList';

const ingredient = (
  overrides: Partial<IngredientFormState>,
): IngredientFormState => ({
  id: 'tmp-1',
  name: 'Flour',
  quantity: 1,
  isOptional: false,
  sortOrder: 0,
  ...overrides,
});

const renderList = (ingredients: IngredientFormState[]) =>
  render(
    <RecipeIngredientList
      ingredients={ingredients}
      onEditIngredient={jest.fn()}
      onRemoveIngredient={jest.fn()}
      onAddIngredient={jest.fn()}
    />,
  );

describe('RecipeIngredientList', () => {
  it('renders a fractional quantity as a cooking fraction', () => {
    renderList([ingredient({ quantity: 1.25 })]);
    expect(screen.getByText('1 1/4')).toBeTruthy();
  });

  it('rounds a quantity no fraction fits to three decimals', () => {
    renderList([ingredient({ quantity: 177.4412 })]);
    expect(screen.getByText('177.441')).toBeTruthy();
  });

  it('shows the unit after the amount', () => {
    renderList([ingredient({ quantity: 2, unitLabel: 'cups' })]);
    expect(screen.getByText('2 cups')).toBeTruthy();
  });

  it('shows only the handling of an ingredient stating no amount', () => {
    renderList([
      ingredient({ quantity: null, unitLabel: 'g', preparation: 'to taste' }),
    ]);
    expect(screen.getByText('to taste')).toBeTruthy();
  });
});
