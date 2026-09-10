import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NutritionDetailList } from '#features/pantry/components/NutritionDetailList';

// Mock the nutritionUtils
jest.mock('#domain/nutrition', () => ({
  parseNutritions: jest.fn((raw: unknown) => raw),
  getNutrientEntries: jest.fn(() => [
    {
      key: 'protein',
      name: 'Protein',
      amount: 15,
      unit: 'g',
      category: 'macro',
    },
    {
      key: 'carbs',
      name: 'Carbohydrates',
      amount: 30,
      unit: 'g',
      category: 'macro',
    },
    { key: 'fat', name: 'Total Fat', amount: 10, unit: 'g', category: 'macro' },
    {
      key: 'vitC',
      name: 'Vitamin C',
      amount: 45,
      unit: 'mg',
      category: 'vitamin',
    },
  ]),
  groupNutrientsByCategory: jest.fn(() => ({
    macro: [
      {
        key: 'protein',
        name: 'Protein',
        amount: 15,
        unit: 'g',
        category: 'macro',
      },
      {
        key: 'carbs',
        name: 'Carbohydrates',
        amount: 30,
        unit: 'g',
        category: 'macro',
      },
      {
        key: 'fat',
        name: 'Total Fat',
        amount: 10,
        unit: 'g',
        category: 'macro',
      },
    ],
    vitamin: [
      {
        key: 'vitC',
        name: 'Vitamin C',
        amount: 45,
        unit: 'mg',
        category: 'vitamin',
      },
    ],
    mineral: [],
    other: [],
  })),
  getCategoryLabel: jest.fn((cat: string) => {
    const labels: Record<string, string> = {
      macro: 'Macronutrients',
      vitamin: 'Vitamins',
      mineral: 'Minerals',
      other: 'Other',
    };
    return labels[cat] || cat;
  }),
  formatNutritionValue: jest.fn(
    (amount: number, unit: string) => `${amount}${unit}`,
  ),
  formatServingSize: jest.fn((grams: number) => `${grams}g`),
  hasNutritionData: jest.fn(() => true),
}));

const mockData = {
  calories: 250,
  protein: 15,
  carbohydrates: 30,
  fat: 10,
  servingSize: '100g',
};

describe('NutritionDetailList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { hasNutritionData } = require('#domain/nutrition');
    (hasNutritionData as jest.Mock).mockReturnValue(true);
  });

  it('renders nutrient names', () => {
    render(<NutritionDetailList nutritions={mockData} />);
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('Carbohydrates')).toBeTruthy();
    expect(screen.getByText('Total Fat')).toBeTruthy();
  });

  it('renders category section titles', () => {
    render(<NutritionDetailList nutritions={mockData} />);
    expect(screen.getByText('Macronutrients')).toBeTruthy();
    expect(screen.getByText('Vitamins')).toBeTruthy();
  });

  it('does not render empty categories', () => {
    render(<NutritionDetailList nutritions={mockData} />);
    expect(screen.queryByText('Minerals')).toBeNull();
    expect(screen.queryByText('Other')).toBeNull();
  });

  it('renders formatted nutrient values', () => {
    render(<NutritionDetailList nutritions={mockData} />);
    expect(screen.getByText('15g')).toBeTruthy();
    expect(screen.getByText('30g')).toBeTruthy();
    expect(screen.getByText('10g')).toBeTruthy();
    expect(screen.getByText('45mg')).toBeTruthy();
  });

  it('renders serving size header when data has servingSize', () => {
    render(<NutritionDetailList nutritions={mockData} />);
    expect(screen.getByText('Serving Size')).toBeTruthy();
    expect(screen.getByText('100g')).toBeTruthy();
  });

  it('renders empty state when no nutrition data', () => {
    const { hasNutritionData } = require('#domain/nutrition');
    (hasNutritionData as jest.Mock).mockReturnValue(false);

    render(<NutritionDetailList nutritions={null} />);
    expect(screen.getByText('No nutrition data available')).toBeTruthy();
  });
});
