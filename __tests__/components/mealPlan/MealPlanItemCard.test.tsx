'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MealPlanItemCard } from '../../../src/components/mealPlan/MealPlanItemCard';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../src/components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

const makeItem = (overrides = {}) => ({
  id: 'mp1',
  isCompleted: false,
  mealType: 'DINNER',
  customMealName: 'Pasta Night',
  recipe: null,
  servings: 4,
  calories: 500,
  notes: null,
  usedPantryItems: [],
  ...overrides,
});

describe('MealPlanItemCard', () => {
  const onToggleCompleted = jest.fn();

  it('renders meal name', () => {
    const { getByText } = render(
      <MealPlanItemCard
        item={makeItem() as any}
        onToggleCompleted={onToggleCompleted}
      />,
    );
    expect(getByText('Pasta Night')).toBeTruthy();
  });

  it('renders recipe name when recipe exists', () => {
    const item = makeItem({
      recipe: { name: 'Spaghetti Bolognese', imageUrl: null, totalTimeMinutes: 30 },
    });
    const { getByText } = render(
      <MealPlanItemCard item={item as any} onToggleCompleted={onToggleCompleted} />,
    );
    expect(getByText('Spaghetti Bolognese')).toBeTruthy();
  });

  it('shows meta info with servings and calories', () => {
    const { getByText } = render(
      <MealPlanItemCard
        item={makeItem() as any}
        onToggleCompleted={onToggleCompleted}
      />,
    );
    expect(getByText('4 servings \u00B7 500 cal')).toBeTruthy();
  });

  it('renders delete button when onDelete provided', () => {
    const onDelete = jest.fn();
    const { toJSON } = render(
      <MealPlanItemCard
        item={makeItem() as any}
        onToggleCompleted={onToggleCompleted}
        onDelete={onDelete}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const onPress = jest.fn();
    const item = makeItem();
    const { getByText } = render(
      <MealPlanItemCard
        item={item as any}
        onToggleCompleted={onToggleCompleted}
        onPress={onPress}
      />,
    );
    fireEvent.press(getByText('Pasta Night'));
    expect(onPress).toHaveBeenCalledWith(item);
  });
});
