import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  UnitPicker,
  type PickableUnitGroup,
} from '#features/pantry/components/UnitPicker';

const groups: PickableUnitGroup[] = [
  {
    type: UnitType.Weight,
    label: 'Weight',
    units: [
      {
        unitId: 'g',
        unitName: 'gram',
        unitSymbol: 'g',
        unitType: UnitType.Weight,
        isTrackingUnit: true,
        conversionRatio: 1,
        conversionConfidence: 1,
      },
      {
        unitId: 'kg',
        unitName: 'kilogram',
        unitSymbol: 'kg',
        unitType: UnitType.Weight,
        isTrackingUnit: false,
        conversionRatio: 1000,
        conversionConfidence: 1,
      },
    ],
  },
];

describe('UnitPicker', () => {
  it('keeps a warm picker on screen while a request is in flight', () => {
    render(
      <UnitPicker
        label="Unit"
        groups={groups}
        selectedUnitId="g"
        onSelect={jest.fn()}
        loading
      />,
    );

    // Reopening the sheet for the same item starts a fresh network leg; the
    // cached units must not be replaced by a spinner.
    expect(screen.getByText('g')).toBeTruthy();
  });

  it('shows the loading state when there is nothing to show yet', () => {
    render(
      <UnitPicker
        label="Unit"
        groups={[]}
        selectedUnitId={undefined}
        onSelect={jest.fn()}
        loading
      />,
    );

    expect(screen.getByText('Unit')).toBeTruthy();
    expect(screen.queryByText('g')).toBeNull();
  });
});
