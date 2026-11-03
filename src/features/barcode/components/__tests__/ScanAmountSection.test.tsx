import React, { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { t } from '#/i18n';
import { ScanAmountSection } from '../ScanAmountSection';
import {
  scanAmountSchema,
  type ScanAmountFormValues,
} from '../scanAmountFormConfig';
import { drainTimers } from '#/test-utils/drainTimers';

// The unit list loads over the network; the section reads only what it shows.
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () =>
  require('#/test-utils/searchResultsStubs'),
);

const oneJar: ScanAmountFormValues = {
  quantityInput: '1',
  unitDisplay: 'jar',
  unitId: 'unit-jar',
  unitType: UnitType.Count,
  sizeInput: '3',
  sizeUnitDisplay: 'lb',
  sizeUnitId: 'unit-lb',
  sizeUnitType: UnitType.Weight,
};

const Harness = ({
  values,
  editing = false,
  onEdit = () => {},
  joins = null,
  checkOnMount = false,
}: {
  values: ScanAmountFormValues;
  editing?: boolean;
  onEdit?: () => void;
  joins?: { amount: string; unitId: string } | null;
  checkOnMount?: boolean;
}) => {
  const form = useForm<ScanAmountFormValues>({
    resolver: yupResolver(scanAmountSchema),
    defaultValues: values,
  });
  const { trigger } = form;
  useEffect(() => {
    if (checkOnMount) void trigger();
  }, [checkOnMount, trigger]);
  return (
    <ScanAmountSection
      form={form}
      editing={editing}
      onEdit={onEdit}
      joins={joins}
    />
  );
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ScanAmountSection', () => {
  it('reads the add as text: the package, then what each one holds', () => {
    render(<Harness values={oneJar} />);
    expect(screen.getByText('1 jar of 3 lb')).toBeTruthy();
  });

  // USM-2: a held product joins its stack, and the summary says which.
  it('says what a held product joins', () => {
    render(
      <Harness
        values={oneJar}
        joins={{ amount: '2 jar', unitId: 'unit-jar' }}
      />,
    );
    expect(
      screen.getByText(
        t('barcode.amount.joinsHeld', {
          amount: '1 jar of 3 lb',
          held: '2 jar',
        }),
      ),
    ).toBeTruthy();
  });

  // In another unit the server joins only where facts convert, else it opens
  // a stack of its own, so the summary claims no join.
  it('claims no join in a unit other than the held stack’s', () => {
    render(
      <Harness
        values={oneJar}
        joins={{ amount: '2 can', unitId: 'unit-can' }}
      />,
    );
    expect(screen.getByText('1 jar of 3 lb')).toBeTruthy();
  });

  it('reads a package of no known size as the count alone', () => {
    render(
      <Harness
        values={{
          ...oneJar,
          sizeInput: '',
          sizeUnitDisplay: '',
          sizeUnitId: null,
        }}
      />,
    );
    expect(screen.getByText('1 jar')).toBeTruthy();
  });

  it('opens its fields from the summary', () => {
    const onEdit = jest.fn();
    render(<Harness values={oneJar} onEdit={onEdit} />);
    fireEvent.press(screen.getByTestId(barcodeTestIDs.scanAmountSummary));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('asks what each one holds for a count, and not for a measure', () => {
    const { unmount } = render(<Harness values={oneJar} editing />);
    expect(screen.getByTestId(barcodeTestIDs.scanAmountSize)).toBeTruthy();
    unmount();

    render(
      <Harness values={{ ...oneJar, unitType: UnitType.Weight }} editing />,
    );
    expect(screen.queryByTestId(barcodeTestIDs.scanAmountSize)).toBeNull();
  });

  it('asks nothing about the unit it is used in', () => {
    render(<Harness values={oneJar} editing />);
    expect(screen.queryByText('Used in')).toBeNull();
  });

  it('drops the size-unit error once the size is cleared', async () => {
    render(
      <Harness
        values={{ ...oneJar, sizeUnitDisplay: '', sizeUnitId: null }}
        editing
        checkOnMount
      />,
    );
    const unitRequired = t('packageSize.unitRequired');
    await drainTimers();
    expect(screen.getByText(unitRequired)).toBeTruthy();

    fireEvent.changeText(screen.getByTestId(barcodeTestIDs.scanAmountSize), '');

    await drainTimers();
    expect(screen.queryByText(unitRequired)).toBeNull();
  });
});
