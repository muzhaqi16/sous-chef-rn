import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import {
  DietaryAlertState,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import type { HouseholdAlert } from '#domain/dietary';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { HouseholdRecipeSummary } from '../HouseholdRecipeSummary';

const PEANUT: HouseholdAlert = {
  id: 'r-peanut',
  memberName: 'Tani',
  what: 'Peanut',
  state: DietaryAlertState.Contains,
  severity: RestrictionSeverity.Allergy,
  isDiet: false,
};
const BACON: HouseholdAlert = {
  id: 'r-bacon',
  memberName: 'You',
  what: 'Bacon',
  state: DietaryAlertState.Contains,
  severity: RestrictionSeverity.Preference,
  isDiet: false,
};

describe('HouseholdRecipeSummary', () => {
  it('names each member and what the recipe meets, then says to check the label', () => {
    render(
      <HouseholdRecipeSummary
        check="checked"
        alerts={[PEANUT, BACON]}
        caveat
      />,
    );

    expect(screen.getByText('Tani')).toBeTruthy();
    expect(
      screen.getByText(t('dietaryAlerts.reason.contains', { what: 'Peanut' })),
    ).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(
      screen.getByText(t('dietaryAlerts.reason.contains', { what: 'Bacon' })),
    ).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkLabel'))).toBeTruthy();
    expect(screen.queryByText(t('dietaryAlerts.stale'))).toBeNull();
  });

  it('shows the alerts it last received offline, marked as possibly out of date', () => {
    render(<HouseholdRecipeSummary check="stale" alerts={[PEANUT]} caveat />);

    expect(screen.getByText('Tani')).toBeTruthy();
    expect(
      screen.getByText(t('dietaryAlerts.reason.contains', { what: 'Peanut' })),
    ).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.stale'))).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkLabel'))).toBeTruthy();
  });

  it('says a never-checked recipe needs a connection, never showing nothing', () => {
    render(<HouseholdRecipeSummary check="unchecked" alerts={[]} caveat />);

    expect(screen.getByTestId(recipesTestIDs.householdUnchecked)).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.needsConnection'))).toBeTruthy();
  });

  it('says the check failed, not that it needs a connection, when online', () => {
    render(<HouseholdRecipeSummary check="failed" alerts={[]} caveat />);

    expect(screen.getByTestId(recipesTestIDs.householdUnchecked)).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkFailed'))).toBeTruthy();
    expect(screen.queryByText(t('dietaryAlerts.needsConnection'))).toBeNull();
  });

  it('shows only the label caveat when nothing was flagged, never calling the recipe safe', () => {
    render(<HouseholdRecipeSummary check="checked" alerts={[]} caveat />);

    expect(screen.getByTestId(recipesTestIDs.householdCaveat)).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkLabel'))).toBeTruthy();
    expect(screen.queryByTestId(recipesTestIDs.householdSummary)).toBeNull();
    expect(screen.queryByText(/safe|-free|no allergens/i)).toBeNull();
  });

  it('shows nothing when nothing was flagged and no restriction can alert', () => {
    render(
      <HouseholdRecipeSummary check="checked" alerts={[]} caveat={false} />,
    );

    expect(screen.queryByTestId(recipesTestIDs.householdSummary)).toBeNull();
    expect(screen.queryByTestId(recipesTestIDs.householdCaveat)).toBeNull();
  });

  it('shows nothing while the check is out, or with no home to check against', () => {
    const { rerender } = render(
      <HouseholdRecipeSummary check="loading" alerts={[PEANUT]} caveat />,
    );
    expect(screen.queryByTestId(recipesTestIDs.householdSummary)).toBeNull();

    rerender(<HouseholdRecipeSummary check="none" alerts={[]} caveat />);
    expect(screen.queryByTestId(recipesTestIDs.householdSummary)).toBeNull();
    expect(screen.queryByTestId(recipesTestIDs.householdUnchecked)).toBeNull();
  });
});
