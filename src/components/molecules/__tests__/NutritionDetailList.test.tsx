import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NutritionDetailList } from '#features/pantry/components/NutritionDetailList';
import type { NutritionFactsValues } from '#domain/nutrition';

const facts: NutritionFactsValues = {
  calories: 250,
  totalFat: 10,
  saturatedFat: null,
  transFat: null,
  cholesterol: null,
  sodium: 45,
  totalCarbs: 30,
  dietaryFiber: null,
  totalSugars: null,
  addedSugars: null,
  protein: 15,
  vitaminD: null,
  calcium: null,
  iron: null,
  potassium: null,
  servingSize: 100,
  servingUnit: 'g',
};

describe('NutritionDetailList', () => {
  it('renders each stored nutrient with its canonical unit', () => {
    render(<NutritionDetailList nutritionFacts={facts} />);
    expect(screen.getByText('Protein')).toBeTruthy();
    expect(screen.getByText('15g')).toBeTruthy();
    expect(screen.getByText('Carbohydrates')).toBeTruthy();
    expect(screen.getByText('30g')).toBeTruthy();
    expect(screen.getByText('Total fat')).toBeTruthy();
    expect(screen.getByText('10g')).toBeTruthy();
    expect(screen.getByText('Calories')).toBeTruthy();
    expect(screen.getByText('250kcal')).toBeTruthy();
    expect(screen.getByText('Sodium')).toBeTruthy();
    expect(screen.getByText('45mg')).toBeTruthy();
  });

  it('renders only the categories that have a value', () => {
    render(<NutritionDetailList nutritionFacts={facts} />);
    expect(screen.getByText('Macronutrients')).toBeTruthy();
    expect(screen.getByText('Minerals')).toBeTruthy();
    expect(screen.queryByText('Vitamins')).toBeNull();
  });

  it('renders the serving size header', () => {
    render(<NutritionDetailList nutritionFacts={facts} />);
    expect(screen.getByText('Serving Size')).toBeTruthy();
    expect(screen.getByText('100 g')).toBeTruthy();
  });

  it('renders empty state when no nutrition data', () => {
    render(<NutritionDetailList nutritionFacts={null} />);
    expect(screen.getByText('No nutrition data available')).toBeTruthy();
  });
});
