import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import {
  DietaryAlertState,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import type { SubstituteOption } from '#features/recipes/hooks/useRecipeSubstitutes';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { SubstitutesSheet } from '../SubstitutesSheet';

const MILK_LEMON: SubstituteOption = {
  id: 's-milk-lemon',
  parts: [
    { key: 'milk', text: '1 cup milk', inPantry: true },
    { key: 'lemon', text: '1 tbsp lemon juice', inPantry: true },
  ],
  stock: 'all',
  per: null,
  note: null,
  alerts: [],
};
const YOGURT: SubstituteOption = {
  id: 's-yogurt',
  parts: [{ key: 'yogurt', text: '¾ cup plain yogurt', inPantry: false }],
  stock: 'none',
  per: '1 cup',
  note: 'Thicker; thin with milk.',
  alerts: [
    {
      id: 'r-dairy',
      memberName: 'John',
      what: 'yogurt',
      state: DietaryAlertState.Contains,
      severity: RestrictionSeverity.Preference,
      isDiet: false,
    },
  ],
};

describe('SubstitutesSheet', () => {
  it('lists each swap with its parts, what the pantry holds, its note and the household notes', () => {
    render(
      <SubstitutesSheet
        visible
        ingredientName="buttermilk"
        options={[MILK_LEMON, YOGURT]}
        onDismiss={jest.fn()}
      />,
    );

    expect(
      screen.getByText(t('recipes.substitutes.title', { name: 'buttermilk' })),
    ).toBeTruthy();
    expect(screen.getByText('1 cup milk')).toBeTruthy();
    expect(screen.getByText('1 tbsp lemon juice')).toBeTruthy();
    // Only the swap the pantry holds whole says so.
    expect(screen.getAllByText(t('recipes.substitutes.inPantry'))).toHaveLength(
      1,
    );
    expect(
      screen.getByText(
        t('recipes.substitutes.per', { amount: '1 cup', name: 'buttermilk' }),
      ),
    ).toBeTruthy();
    expect(screen.getByText('Thicker; thin with milk.')).toBeTruthy();
    expect(
      screen.getByText(
        t('dietaryAlerts.contains', { name: 'John', what: 'yogurt' }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByTestId(recipesTestIDs.substituteOption('s-yogurt')),
    ).toBeTruthy();
  });
});
