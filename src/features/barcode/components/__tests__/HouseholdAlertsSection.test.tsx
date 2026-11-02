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
        caveat
        check="checked"
        alerts={[PEANUT, VEGAN]}
        alternatives={[]}
      />,
    );

    expect(screen.getByText('Tani')).toBeTruthy();
    expect(
      screen.getByText(t('dietaryAlerts.reason.contains', { what: 'Peanut' })),
    ).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(
      screen.getByText(t('dietaryAlerts.reason.mayNotDiet', { what: 'Vegan' })),
    ).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkLabel'))).toBeTruthy();
    expect(screen.queryByText(t('dietaryAlerts.stale'))).toBeNull();
  });

  it('shows only the label caveat when nothing matched, never calling the product safe', () => {
    render(
      <HouseholdAlertsSection
        check="checked"
        alerts={[]}
        caveat
        alternatives={[]}
      />,
    );

    expect(screen.getByTestId(barcodeTestIDs.householdCaveat)).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkLabel'))).toBeTruthy();
    expect(screen.queryByText(t('dietaryAlerts.title'))).toBeNull();
    expect(screen.queryByText(/safe|-free|no allergens/i)).toBeNull();
  });

  it('shows nothing when nothing matched and no restriction can alert', () => {
    render(
      <HouseholdAlertsSection
        check="checked"
        alerts={[]}
        caveat={false}
        alternatives={[]}
      />,
    );

    expect(screen.queryByTestId(barcodeTestIDs.householdAlerts)).toBeNull();
    expect(screen.queryByTestId(barcodeTestIDs.householdCaveat)).toBeNull();
  });

  it('marks a caveat-only answer from earlier as possibly out of date', () => {
    render(
      <HouseholdAlertsSection
        check="stale"
        alerts={[]}
        caveat
        alternatives={[]}
      />,
    );

    expect(screen.getByText(t('dietaryAlerts.stale'))).toBeTruthy();
    expect(screen.getByText(t('dietaryAlerts.checkLabel'))).toBeTruthy();
  });

  it('marks an earlier answer offline as possibly out of date', () => {
    render(
      <HouseholdAlertsSection
        caveat
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
        caveat
        check="unchecked"
        alerts={[]}
        alternatives={[]}
      />,
    );

    expect(screen.getByText(t('dietaryAlerts.needsConnection'))).toBeTruthy();
  });

  it('says the check failed, not that it needs a connection, when online', () => {
    render(
      <HouseholdAlertsSection
        check="failed"
        alerts={[]}
        caveat={false}
        alternatives={[]}
      />,
    );

    expect(screen.getByText(t('dietaryAlerts.checkFailed'))).toBeTruthy();
    expect(screen.queryByText(t('dietaryAlerts.needsConnection'))).toBeNull();
  });

  it('opens an alternative that has a barcode', () => {
    const onOpen = jest.fn();
    render(
      <HouseholdAlertsSection
        caveat
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
