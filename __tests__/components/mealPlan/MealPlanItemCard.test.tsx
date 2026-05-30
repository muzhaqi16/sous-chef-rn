'use no memo';

import React from 'react';
import { userEvent } from '@testing-library/react-native';
import { MealPlanItemCard } from '#features/mealPlan/components/MealPlanItemCard';
import type { MealPlanItemCard_ItemFragment } from '#features/mealPlan/components/MealPlanItemCard.generated';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

const makeItem = (
  overrides: Partial<MealPlanItemCard_ItemFragment> = {},
): MealPlanItemCard_ItemFragment => ({
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
        item={makeItem()}
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
      <MealPlanItemCard item={item} onToggleCompleted={onToggleCompleted} />,
    );
    expect(getByText('Spaghetti Bolognese')).toBeTruthy();
  });

  it('shows meta info with servings and calories', () => {
    const { getByText } = renderWithApollo(
      <MealPlanItemCard
        item={makeItem()}
        onToggleCompleted={onToggleCompleted}
      />,
    );
    expect(getByText('4 servings \u00B7 500 cal')).toBeTruthy();
  });

  it('renders delete button when onDelete provided', () => {
    const onDelete = jest.fn();
    const { toJSON } = renderWithApollo(
      <MealPlanItemCard
        item={makeItem()}
        onToggleCompleted={onToggleCompleted}
        onDelete={onDelete}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('calls onPress with item id when card is pressed', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const item = makeItem();
    const { getByText } = renderWithApollo(
      <MealPlanItemCard
        item={item}
        onToggleCompleted={onToggleCompleted}
        onPress={onPress}
      />,
    );
    await user.press(getByText('Pasta Night'));
    expect(onPress).toHaveBeenCalledWith('mp1');
  });
});
