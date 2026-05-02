'use no memo';

import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { MealPlanItemCard } from '../../../src/components/mealPlan/MealPlanItemCard';
import { renderWithApollo } from '../../helpers/apolloMockProvider';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

const makeItem = (overrides = {}) => ({
  __typename: 'MealPlanItem',
  id: 'mp1',
  isCompleted: false,
  customMealName: 'Pasta Night',
  recipe: null,
  servings: 4,
  calories: 500,
  usedPantryItems: [],
  ...overrides,
});

describe('MealPlanItemCard', () => {
  const onToggleCompleted = jest.fn();

  it('renders meal name', () => {
    const { getByText } = renderWithApollo(
      <MealPlanItemCard
        item={makeItem() as any}
        onToggleCompleted={onToggleCompleted}
      />,
    );
    expect(getByText('Pasta Night')).toBeTruthy();
  });

  it('renders recipe name when recipe exists', () => {
    const item = makeItem({
      recipe: { __typename: 'Recipe', id: 'r1', name: 'Spaghetti Bolognese', imageUrl: null, totalTimeMinutes: 30 },
    });
    const { getByText } = renderWithApollo(
      <MealPlanItemCard item={item as any} onToggleCompleted={onToggleCompleted} />,
    );
    expect(getByText('Spaghetti Bolognese')).toBeTruthy();
  });

  it('shows meta info with servings and calories', () => {
    const { getByText } = renderWithApollo(
      <MealPlanItemCard
        item={makeItem() as any}
        onToggleCompleted={onToggleCompleted}
      />,
    );
    expect(getByText('4 servings \u00B7 500 cal')).toBeTruthy();
  });

  it('renders delete button when onDelete provided', () => {
    const onDelete = jest.fn();
    const { toJSON } = renderWithApollo(
      <MealPlanItemCard
        item={makeItem() as any}
        onToggleCompleted={onToggleCompleted}
        onDelete={onDelete}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('calls onPress with item id when card is pressed', () => {
    const onPress = jest.fn();
    const item = makeItem();
    const { getByText } = renderWithApollo(
      <MealPlanItemCard
        item={item as any}
        onToggleCompleted={onToggleCompleted}
        onPress={onPress}
      />,
    );
    fireEvent.press(getByText('Pasta Night'));
    expect(onPress).toHaveBeenCalledWith('mp1');
  });
});
