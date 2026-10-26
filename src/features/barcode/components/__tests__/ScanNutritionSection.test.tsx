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
    render(
      <ScanNutritionSection nutrition={{ facts: TUNA, typicalOf: null }} />,
    );
    expect(screen.getByText(t('barcode.nutrition.title'))).toBeTruthy();
    expect(screen.getByText('71')).toBeTruthy();
    expect(screen.getByText('10.6')).toBeTruthy();
  });

  it.each([
    ['no facts', undefined],
    ['facts with no macro', NONE],
  ])('shows nothing for %s', (_label, facts) => {
    render(
      <ScanNutritionSection
        nutrition={facts ? { facts, typicalOf: null } : undefined}
      />,
    );
    expect(screen.queryByTestId(barcodeTestIDs.productNutrition)).toBeNull();
  });

  it('opens every nutrient from the card', () => {
    const onOpenDetails = jest.fn();
    render(
      <ScanNutritionSection
        nutrition={{ facts: TUNA, typicalOf: null }}
        onOpenDetails={onOpenDetails}
      />,
    );
    fireEvent.press(screen.getByText(t('labels.viewDetails')));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  // A product whose record states none reads its concept's values, titled as
  // typical and never as the product's own.
  it('titles a concept’s values as typical of it', () => {
    render(
      <ScanNutritionSection
        nutrition={{
          facts: TUNA,
          typicalOf: 'chipotle peppers in adobo sauce',
        }}
      />,
    );
    expect(
      screen.getByText(
        t('labels.typicalFor', { concept: 'chipotle peppers in adobo sauce' }),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(t('barcode.nutrition.title'))).toBeNull();
    expect(screen.getByText('71')).toBeTruthy();
  });
});
