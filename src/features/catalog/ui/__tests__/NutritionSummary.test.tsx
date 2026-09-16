import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { NutritionSummary } from '#features/catalog/ui/NutritionSummary';
import type { NutritionSummaryFacts } from '#domain/nutrition';

// `Item.nutritionFacts` as the API returns it: flat numbers in canonical units.
const facts: NutritionSummaryFacts = {
  calories: 250,
  protein: 15,
  totalCarbs: 30.4,
  totalFat: 10,
  dietaryFiber: 1,
  totalSugars: 12,
  sodium: 90,
  calcium: null,
  iron: null,
  potassium: null,
  servingSize: 100,
  servingUnit: 'g',
};

describe('NutritionSummary', () => {
  it("renders the API's macro values, not placeholders", () => {
    // `nutritions.calories.amount` on the flat Json mirror, where no nutrient
    // is an object, is undefined, so the summary renders nothing.
    render(<NutritionSummary nutritionFacts={facts} />);
    expect(screen.getByText('Calories')).toBeTruthy();
    expect(screen.getByText('250')).toBeTruthy();
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('Carbs')).toBeTruthy();
    expect(screen.getByText('30.4')).toBeTruthy();
    expect(screen.getByText('Fat')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.queryByText('-')).toBeNull();
  });

  it('renders the serving the figures are stated for', () => {
    render(<NutritionSummary nutritionFacts={facts} />);
    expect(screen.getByText('Per 100 g')).toBeTruthy();
  });

  it('renders highlight badges when showHighlights is true', () => {
    render(<NutritionSummary nutritionFacts={facts} showHighlights />);
    expect(screen.getByText('High Protein')).toBeTruthy();
  });

  it('does not render highlights when showHighlights is false', () => {
    render(<NutritionSummary nutritionFacts={facts} showHighlights={false} />);
    expect(screen.queryByText('High Protein')).toBeNull();
  });

  it('calls onPress from View Details', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(<NutritionSummary nutritionFacts={facts} onPress={onPress} />);
    await user.press(screen.getByText('View Details'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for an item with no facts', () => {
    const { toJSON } = render(<NutritionSummary nutritionFacts={null} />);
    expect(toJSON()).toBeNull();
  });
});
