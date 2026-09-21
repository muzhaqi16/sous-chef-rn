import React from 'react';
import { screen } from '@testing-library/react-native';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';
import { MealPlanItemCard } from '../MealPlanItemCard';
import type { MealPlanItemCard_ItemFragment } from '../MealPlanItemCard.generated';

const meal = (
  totalTimeMinutes: number | null,
): MealPlanItemCard_ItemFragment => ({
  __typename: 'MealPlanItem',
  id: 'mpi-1',
  isCompleted: false,
  customMealName: null,
  servings: null,
  calories: null,
  usedPantryItems: [],
  recipe: {
    __typename: 'Recipe',
    id: 'r-1',
    name: 'Pizza',
    imageUrl: null,
    totalTimeMinutes,
  },
});

describe('MealPlanItemCard', () => {
  // A recipe with no known time stores 0.
  it('shows no time for a recipe whose time is 0', () => {
    renderWithApollo(<MealPlanItemCard item={meal(0)} />);

    expect(screen.getByText('Pizza')).toBeTruthy();
    expect(screen.queryByText('0 min')).toBeNull();
  });

  it('shows the time a recipe takes', () => {
    renderWithApollo(<MealPlanItemCard item={meal(25)} />);

    expect(screen.getByText('25 min')).toBeTruthy();
  });
});
