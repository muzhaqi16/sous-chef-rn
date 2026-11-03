import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  UnitPicker,
  type PickableUnitGroup,
} from '#features/pantry/components/UnitPicker';

const unitOf = (
  id: string,
  type = UnitType.Volume,
  isTrackingUnit = false,
) => ({
  unitId: id,
  unit: { symbol: id, name: id },
  unitType: type,
  isTrackingUnit,
  conversionRatio: 1,
  conversionConfidence: 1,
});

// A case of soda, as the server ranks it.
const soda = [
  unitOf('can', UnitType.Count),
  unitOf('case', UnitType.Count, true),
  unitOf('fl oz'),
  unitOf('cup'),
  unitOf('pinch'),
];
// The same case last used in tbsp: the server ranks that unit first, which
// pushes the case past three.
const sodaLastUsedInTbsp = [
  unitOf('tbsp'),
  unitOf('can', UnitType.Count),
  unitOf('fl oz'),
  unitOf('case', UnitType.Count, true),
  unitOf('cup'),
  unitOf('pinch'),
];
const sodaGroups: PickableUnitGroup[] = [
  { type: UnitType.Count, label: 'Count', units: soda.slice(0, 2) },
  { type: UnitType.Volume, label: 'Volume', units: soda.slice(2) },
];

const pickerProps = {
  label: 'Consume by',
  ranked: soda,
  groups: sodaGroups,
  selectedUnitId: 'can',
  onSelect: jest.fn(),
  loading: false,
};

describe('UnitPicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps a warm picker on screen while a request is in flight', () => {
    render(<UnitPicker {...pickerProps} loading />);

    // Reopening the sheet for the same item starts a fresh network leg; the
    // cached units must not be replaced by a spinner.
    expect(screen.getByText('can')).toBeTruthy();
  });

  it('shows the loading state when there is nothing to show yet', () => {
    render(<UnitPicker {...pickerProps} ranked={[]} groups={[]} loading />);

    expect(screen.getByText('Consume by')).toBeTruthy();
    expect(screen.queryByText('can')).toBeNull();
  });

  it('leads with three units, in the server’s order', () => {
    render(<UnitPicker {...pickerProps} />);

    expect(screen.getByText('can')).toBeTruthy();
    expect(screen.getByText('case')).toBeTruthy();
    expect(screen.getByText('fl oz')).toBeTruthy();
    expect(screen.queryByText('pinch')).toBeNull();
    expect(screen.getByText('More')).toBeTruthy();
  });

  it('keeps every unit reachable behind More', () => {
    render(<UnitPicker {...pickerProps} />);

    fireEvent.press(screen.getByText('More'));

    expect(screen.getByText('pinch')).toBeTruthy();
    expect(screen.getByText('Count')).toBeTruthy();
  });

  it('picks a unit from More and keeps it shown', () => {
    const onSelect = jest.fn();
    const { rerender } = render(
      <UnitPicker {...pickerProps} onSelect={onSelect} />,
    );

    fireEvent.press(screen.getByText('More'));
    fireEvent.press(screen.getByText('cup'));
    expect(onSelect).toHaveBeenCalledWith(soda[3]);

    rerender(<UnitPicker {...pickerProps} selectedUnitId="cup" />);
    expect(screen.getByText('cup')).toBeTruthy();
    expect(screen.queryByText('pinch')).toBeNull();
  });

  it('keeps the package in view when a last-used unit pushes it past three', () => {
    render(
      <UnitPicker
        {...pickerProps}
        ranked={sodaLastUsedInTbsp}
        selectedUnitId="tbsp"
      />,
    );

    expect(screen.getByText('tbsp')).toBeTruthy();
    expect(screen.getByText('can')).toBeTruthy();
    expect(screen.getByText('case')).toBeTruthy();
    expect(screen.queryByText('fl oz')).toBeNull();
  });

  it('keeps both the package and a unit picked from More in view', () => {
    render(
      <UnitPicker
        {...pickerProps}
        ranked={sodaLastUsedInTbsp}
        selectedUnitId="cup"
      />,
    );

    expect(screen.getByText('tbsp')).toBeTruthy();
    expect(screen.getByText('case')).toBeTruthy();
    expect(screen.getByText('cup')).toBeTruthy();
    expect(screen.queryByText('can')).toBeNull();
  });

  it('shows no More at three units or fewer', () => {
    render(<UnitPicker {...pickerProps} ranked={soda.slice(0, 2)} />);

    expect(screen.queryByText('More')).toBeNull();
  });

  it('asks nothing with one unit to choose from', () => {
    render(<UnitPicker {...pickerProps} ranked={soda.slice(0, 1)} />);

    expect(screen.queryByText('Consume by')).toBeNull();
  });
});
