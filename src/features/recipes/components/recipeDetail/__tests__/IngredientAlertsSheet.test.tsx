import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import {
  DietaryAlertState,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import type { SubstituteOption } from '#features/recipes/hooks/useRecipeSubstitutes';
import { recipesTestIDs } from '#features/recipes/testIDs';
import type { HouseholdAlert } from '#domain/dietary';
import { IngredientAlertsSheet } from '../IngredientAlertsSheet';

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

const ALLERGY: HouseholdAlert = {
  id: 'r-ana',
  memberName: 'Ana',
  what: 'Dairy',
  state: DietaryAlertState.Contains,
  severity: RestrictionSeverity.Allergy,
  isDiet: false,
};
const AVOIDED: HouseholdAlert = {
  id: 'r-you',
  memberName: 'You',
  what: 'Buttermilk',
  state: DietaryAlertState.MayContain,
  severity: RestrictionSeverity.Preference,
  isDiet: false,
};

const renderSheet = (
  over: Partial<React.ComponentProps<typeof IngredientAlertsSheet>> = {},
) =>
  render(
    <IngredientAlertsSheet
      visible
      ingredientName="buttermilk"
      alerts={[AVOIDED, ALLERGY]}
      stale={false}
      options={[]}
      isAdded={false}
      onAdd={jest.fn()}
      onDismiss={jest.fn()}
      {...over}
    />,
  );

describe('IngredientAlertsSheet', () => {
  it('lists who it affects, the allergy first, each with how serious and why', () => {
    renderSheet();

    expect(screen.getByText('buttermilk')).toBeTruthy();
    expect(screen.getByText(t('recipes.ingredientAlerts.lead'))).toBeTruthy();
    const names = screen
      .getAllByText(/^(Ana|You)$/)
      .map(node => node.props.children);
    expect(names).toEqual(['Ana', 'You']);
    expect(
      screen.getByText(t('dietaryProfile.avoidSeverity.allergy')),
    ).toBeTruthy();
    expect(
      screen.getByText(t('dietaryProfile.avoidSeverity.preference')),
    ).toBeTruthy();
    expect(
      screen.getByText(t('dietaryAlerts.reason.contains', { what: 'Dairy' })),
    ).toBeTruthy();
    expect(
      screen.getByText(
        t('dietaryAlerts.reason.mayContain', { what: 'Buttermilk' }),
      ),
    ).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkLabel'))).toBeTruthy();
    expect(screen.queryByText(t('dietaryAlerts.stale'))).toBeNull();
  });

  it('says when the answer is from earlier', () => {
    renderSheet({ stale: true });

    expect(screen.getByText(t('dietaryAlerts.stale'))).toBeTruthy();
  });

  it('adds it anyway from the sheet, and says once it is added', () => {
    const onAdd = jest.fn();
    const { rerender } = renderSheet({ onAdd });

    fireEvent.press(screen.getByTestId(recipesTestIDs.ingredientSheetAdd));
    expect(onAdd).toHaveBeenCalledTimes(1);

    rerender(
      <IngredientAlertsSheet
        visible
        ingredientName="buttermilk"
        alerts={[ALLERGY]}
        stale={false}
        options={[]}
        isAdded
        onAdd={onAdd}
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText(t('labels.added'))).toBeTruthy();
  });

  it('lists each swap with its parts, what the pantry holds, its note and the household notes', () => {
    renderSheet({ alerts: [ALLERGY], options: [MILK_LEMON, YOGURT] });

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
    expect(screen.getByText('John')).toBeTruthy();
    expect(
      screen.getByText(t('dietaryAlerts.reason.contains', { what: 'yogurt' })),
    ).toBeTruthy();
    expect(
      screen.getByTestId(recipesTestIDs.substituteOption('s-yogurt')),
    ).toBeTruthy();
  });

  it('offers no swaps where none is known', () => {
    renderSheet();

    expect(
      screen.queryByText(
        t('recipes.substitutes.title', { name: 'buttermilk' }),
      ),
    ).toBeNull();
  });
});
