import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { DietaryCheckNote } from '../DietaryCheckNote';

describe('DietaryCheckNote', () => {
  it('says a never-checked recipe needs a connection, never showing nothing', () => {
    render(
      <DietaryCheckNote check="unchecked" flagged={false} restrictionsApply />,
    );

    expect(screen.getByTestId(recipesTestIDs.householdUnchecked)).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.needsConnection'))).toBeTruthy();
  });

  it('says the check failed, not that it needs a connection, when online', () => {
    render(
      <DietaryCheckNote check="failed" flagged={false} restrictionsApply />,
    );

    expect(screen.getByTestId(recipesTestIDs.householdUnchecked)).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkFailed'))).toBeTruthy();
    expect(screen.queryByText(t('dietaryAlerts.needsConnection'))).toBeNull();
  });

  it('shows nothing on a settled check, flagged or not, never calling the recipe safe', () => {
    const { rerender } = render(
      <DietaryCheckNote check="checked" flagged restrictionsApply />,
    );
    expect(screen.toJSON()).toBeNull();

    rerender(
      <DietaryCheckNote check="checked" flagged={false} restrictionsApply />,
    );
    expect(screen.toJSON()).toBeNull();
  });

  it('notes an earlier answer, whether or not it flagged anything', () => {
    const { rerender } = render(
      <DietaryCheckNote check="stale" flagged={false} restrictionsApply />,
    );
    expect(screen.getByTestId(recipesTestIDs.householdStale)).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.stale'))).toBeTruthy();

    rerender(
      <DietaryCheckNote check="stale" flagged restrictionsApply={false} />,
    );
    expect(screen.getByTestId(recipesTestIDs.householdStale)).toBeTruthy();
  });

  it('shows nothing on an earlier answer when no restriction can alert', () => {
    render(
      <DietaryCheckNote
        check="stale"
        flagged={false}
        restrictionsApply={false}
      />,
    );

    expect(screen.toJSON()).toBeNull();
  });

  it('shows nothing while the check is out, or with no home to check against', () => {
    const { rerender } = render(
      <DietaryCheckNote check="loading" flagged restrictionsApply />,
    );
    expect(screen.toJSON()).toBeNull();

    rerender(
      <DietaryCheckNote check="none" flagged={false} restrictionsApply />,
    );
    expect(screen.toJSON()).toBeNull();
  });
});
