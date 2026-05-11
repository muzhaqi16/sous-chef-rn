import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { NutritionSummary } from '../NutritionSummary';

// Mock the nutritionUtils to control outputs
jest.mock('#utils/nutritionUtils', () => ({
  parseNutritions: jest.fn((raw: any) => raw),
  extractMacroSummary: jest.fn(() => ({
    calories: 250,
    protein: 15,
    carbs: 30,
    fat: 10,
    servingSize: '100g',
  })),
  generateHighlights: jest.fn(() => [
    { label: 'High Protein', type: 'positive' },
  ]),
  formatNutritionValue: jest.fn((val: number, unit: string) =>
    unit ? `${val}${unit}` : `${val}`,
  ),
  formatCalories: jest.fn((val: number) => `${val}`),
  hasNutritionData: jest.fn(() => true),
}));

const mockNutritionData = {
  calories: 250,
  protein: 15,
  carbohydrates: 30,
  fat: 10,
  servingSize: '100g',
};

describe('NutritionSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-set hasNutritionData to return true by default
    const { hasNutritionData } = require('#utils/nutritionUtils');
    (hasNutritionData as jest.Mock).mockReturnValue(true);
  });

  it('renders macro circles for calories, protein, carbs, fat', () => {
    render(<NutritionSummary nutritions={mockNutritionData} />);
    expect(screen.getByText('Calories')).toBeTruthy();
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('Carbs')).toBeTruthy();
    expect(screen.getByText('Fat')).toBeTruthy();
  });

  it('renders serving size label', () => {
    render(<NutritionSummary nutritions={mockNutritionData} />);
    expect(screen.getByText('Per 100g')).toBeTruthy();
  });

  it('renders highlight badges when showHighlights is true', () => {
    render(<NutritionSummary nutritions={mockNutritionData} showHighlights />);
    expect(screen.getByText('High Protein')).toBeTruthy();
  });

  it('does not render highlights when showHighlights is false', () => {
    render(
      <NutritionSummary
        nutritions={mockNutritionData}
        showHighlights={false}
      />,
    );
    expect(screen.queryByText('High Protein')).toBeNull();
  });

  it('renders View Details when onPress is provided', () => {
    render(
      <NutritionSummary nutritions={mockNutritionData} onPress={jest.fn()} />,
    );
    expect(screen.getByText('View Details')).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(
      <NutritionSummary nutritions={mockNutritionData} onPress={onPress} />,
    );
    await user.press(screen.getByText('View Details'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('returns null when no nutrition data is available', () => {
    const { hasNutritionData } = require('#utils/nutritionUtils');
    (hasNutritionData as jest.Mock).mockReturnValue(false);

    const { toJSON } = render(<NutritionSummary nutritions={null} />);
    expect(toJSON()).toBeNull();
  });
});
