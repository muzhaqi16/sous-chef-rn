import React from 'react';
import { screen } from '@testing-library/react-native';
import {
  renderWithApollo,
  seedCache,
  toFragmentRef,
} from '#/test-utils/apolloMockProvider';
import { MealPlanItemCard } from '../MealPlanItemCard';
import {
  MealPlanItemCard_ItemFragmentDoc,
  type MealPlanItemCard_ItemFragment,
} from '../MealPlanItemCard.generated';

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

const ref = toFragmentRef<typeof MealPlanItemCard_ItemFragmentDoc>({
  __typename: 'MealPlanItem',
  id: 'mpi-1',
});

const renderCard = (item: MealPlanItemCard_ItemFragment | null) =>
  renderWithApollo(<MealPlanItemCard item={ref} />, {
    cache: seedCache(
      item
        ? [
            {
              data: item,
              fragment: MealPlanItemCard_ItemFragmentDoc,
              fragmentName: 'MealPlanItemCard_item',
            },
          ]
        : [],
    ),
  });

describe('MealPlanItemCard', () => {
  // A recipe with no known time stores 0.
  it('shows no time for a recipe whose time is 0', () => {
    renderCard(meal(0));

    expect(screen.getByText('Pizza')).toBeTruthy();
    expect(screen.queryByText('0 min')).toBeNull();
  });

  it('shows the time a recipe takes', () => {
    renderCard(meal(25));

    expect(screen.getByText('25 min')).toBeTruthy();
  });

  it('renders nothing while the item is not completely cached', () => {
    renderCard(null);

    expect(screen.queryByText('Pizza')).toBeNull();
  });
});
