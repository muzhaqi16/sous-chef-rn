'use no memo';

import React from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { NutritionSummaryCard } from '../../../src/features/mealPlan/components/NutritionSummaryCard';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/features/mealPlan/components/NutritionGoalProgress', () => ({
  NutritionGoalProgress: () => null,
}));

const makeSummary = (overrides = {}) => ({
  avgDailyCalories: 2000,
  avgDailyProtein: 80,
  avgDailyCarbs: 250,
  avgDailyFat: 70,
  totalCalories: 14000,
  totalMeals: 21,
  mealsWithNutrition: 18,
  coveragePercentage: 85.7,
  ...overrides,
});

describe('NutritionSummaryCard', () => {
  it('renders title', () => {
    const { getByText } = render(
      <NutritionSummaryCard nutritionSummary={makeSummary() as any} />,
    );
    expect(getByText('Nutrition Summary')).toBeTruthy();
  });

  it('shows collapsed calories by default', () => {
    const { getByText } = render(
      <NutritionSummaryCard nutritionSummary={makeSummary() as any} />,
    );
    expect(getByText('2000 kcal/day')).toBeTruthy();
  });

  it('expands to show details when pressed', async () => {
    const user = userEvent.setup();
    const { getByText } = render(
      <NutritionSummaryCard nutritionSummary={makeSummary() as any} />,
    );
    await user.press(getByText('Nutrition Summary'));
    expect(getByText('Daily Averages')).toBeTruthy();
    expect(getByText('Plan Totals')).toBeTruthy();
  });

  it('shows macro stats when expanded', async () => {
    const user = userEvent.setup();
    const { getByText } = render(
      <NutritionSummaryCard nutritionSummary={makeSummary() as any} />,
    );
    await user.press(getByText('Nutrition Summary'));
    expect(getByText('Calories')).toBeTruthy();
    expect(getByText('Protein')).toBeTruthy();
    expect(getByText('Carbs')).toBeTruthy();
    expect(getByText('Fat')).toBeTruthy();
  });
});
