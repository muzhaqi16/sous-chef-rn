import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import {
  DietaryAlertState,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import type { HouseholdAlert } from '#domain/dietary';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { HouseholdAlertsSection } from '../HouseholdAlertsSection';

const PEANUT: HouseholdAlert = {
  id: 'r-peanut',
  memberName: 'Tani',
  what: 'Peanut',
  state: DietaryAlertState.Contains,
  severity: RestrictionSeverity.Allergy,
  isDiet: false,
};
const VEGAN: HouseholdAlert = {
  id: 'r-vegan',
  memberName: 'You',
  what: 'Vegan',
  state: DietaryAlertState.MayContain,
  severity: RestrictionSeverity.Preference,
  isDiet: true,
};

describe('HouseholdAlertsSection', () => {
  it('names each member and what the product meets, then says to check the label', () => {
    render(
      <HouseholdAlertsSection
        check="checked"
        alerts={[PEANUT, VEGAN]}
        alternatives={[]}
      />,
    );

    expect(
      screen.getByText(
        t('dietaryAlerts.contains', { name: 'Tani', what: 'Peanut' }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        t('dietaryAlerts.mayNotDiet', { name: 'You', what: 'Vegan' }),
      ),
    ).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkLabel'))).toBeTruthy();
    expect(screen.queryByText(t('dietaryAlerts.stale'))).toBeNull();
  });

  it('shows nothing when nothing was found, never calling the product safe', () => {
    render(
      <HouseholdAlertsSection check="checked" alerts={[]} alternatives={[]} />,
    );

    expect(screen.queryByTestId(barcodeTestIDs.householdAlerts)).toBeNull();
    expect(screen.queryByText(t('dietaryAlerts.checkLabel'))).toBeNull();
  });

  it('marks an earlier answer offline as possibly out of date', () => {
    render(
      <HouseholdAlertsSection
        check="stale"
        alerts={[PEANUT]}
        alternatives={[]}
      />,
    );

    expect(screen.getByText(t('dietaryAlerts.stale'))).toBeTruthy();
  });

  it('says a never-checked product needs a connection', () => {
    render(
      <HouseholdAlertsSection
        check="unchecked"
        alerts={[]}
        alternatives={[]}
      />,
    );

    expect(screen.getByText(t('dietaryAlerts.needsConnection'))).toBeTruthy();
  });

  it('opens an alternative that has a barcode', () => {
    const onOpen = jest.fn();
    render(
      <HouseholdAlertsSection
        check="checked"
        alerts={[PEANUT]}
        alternatives={[
          {
            id: 'oat-granola',
            name: 'Oat Granola',
            imageUrl: null,
            primaryUpc: '012345678905',
          },
        ]}
        onOpenAlternative={onOpen}
      />,
    );

    fireEvent.press(screen.getByText('Oat Granola'));

    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'oat-granola' }),
    );
  });
});
