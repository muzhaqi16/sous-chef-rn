import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import type { NutritionFactsValues } from '#domain/nutrition';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { ScanNutritionSection } from '../ScanNutritionSection';

const NONE: NutritionFactsValues = {
  calories: null,
  totalFat: null,
  saturatedFat: null,
  transFat: null,
  cholesterol: null,
  sodium: null,
  totalCarbs: null,
  dietaryFiber: null,
  totalSugars: null,
  addedSugars: null,
  protein: null,
  vitaminD: null,
  calcium: null,
  iron: null,
  potassium: null,
  servingSize: null,
  servingUnit: null,
};

// The Unmeat tuna, per 100 g.
const TUNA: NutritionFactsValues = {
  ...NONE,
  calories: 71,
  protein: 10.6,
  totalCarbs: 5.88,
  totalFat: 0,
  dietaryFiber: 2.4,
};

describe('ScanNutritionSection', () => {
  it('shows the calories and macros a source states', () => {
    render(<ScanNutritionSection nutritionFacts={TUNA} />);
    expect(screen.getByText(t('barcode.nutrition.title'))).toBeTruthy();
    expect(screen.getByText('71')).toBeTruthy();
    expect(screen.getByText('10.6')).toBeTruthy();
  });

  it.each([
    ['no facts', undefined],
    ['facts with no macro', NONE],
  ])('shows nothing for %s', (_label, facts) => {
    render(<ScanNutritionSection nutritionFacts={facts} />);
    expect(screen.queryByTestId(barcodeTestIDs.productNutrition)).toBeNull();
  });

  it('opens every nutrient from the card', () => {
    const onOpenDetails = jest.fn();
    render(
      <ScanNutritionSection
        nutritionFacts={TUNA}
        onOpenDetails={onOpenDetails}
      />,
    );
    fireEvent.press(screen.getByText(t('labels.viewDetails')));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });
});
