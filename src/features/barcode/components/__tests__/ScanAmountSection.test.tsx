import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
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

// The unit list loads over the network; the section reads only what it shows.
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () =>
  require('#/test-utils/searchResultsStubs'),
);

const oneJar: ScanAmountFormValues = {
  packaged: true,
  quantityInput: '1',
  unitDisplay: 'jar',
  unitId: 'unit-jar',
  unitType: UnitType.Count,
  sizeInput: '3',
  sizeUnitDisplay: 'lb',
  sizeUnitId: 'unit-lb',
  consumeUnitDisplay: '',
  consumeUnitId: null,
};

const usedInTbsp: ScanAmountFormValues = {
  ...oneJar,
  consumeUnitDisplay: 'tbsp',
  consumeUnitId: 'unit-tbsp',
};

const Harness = ({
  values,
  editing = false,
  onEdit = () => {},
  createsStack = true,
  joins = null,
}: {
  values: ScanAmountFormValues;
  editing?: boolean;
  onEdit?: () => void;
  createsStack?: boolean;
  joins?: string | null;
}) => {
  const form = useForm<ScanAmountFormValues>({
    resolver: yupResolver(scanAmountSchema),
    defaultValues: values,
  });
  return (
    <ScanAmountSection
      form={form}
      editing={editing}
      onEdit={onEdit}
      createsStack={createsStack}
      joins={joins}
    />
  );
};

describe('ScanAmountSection', () => {
  it('reads the add as text: the package, then what each one holds', () => {
    render(<Harness values={oneJar} />);
    expect(screen.getByText('1 jar · 3 lb each')).toBeTruthy();
  });

  // USM-2: a held product joins its stack, and the summary says which.
  it('says what a held product joins', () => {
    render(<Harness values={oneJar} createsStack={false} joins="2 jar" />);
    expect(
      screen.getByText(
        t('barcode.amount.joinsHeld', {
          amount: '1 jar · 3 lb each',
          held: '2 jar',
        }),
      ),
    ).toBeTruthy();
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

  it('asks for the size of one package only while packaged', () => {
    render(<Harness values={oneJar} editing />);
    expect(screen.getByTestId(barcodeTestIDs.scanAmountSize)).toBeTruthy();
    expect(screen.getByText(t('labels.package'))).toBeTruthy();

    fireEvent(
      screen.getByTestId(barcodeTestIDs.scanAmountPackaged),
      'valueChange',
      false,
    );

    expect(screen.queryByTestId(barcodeTestIDs.scanAmountSize)).toBeNull();
    expect(screen.getByText(t('labels.unit'))).toBeTruthy();
  });

  it('drops the size-unit error once the size is cleared', async () => {
    render(
      <Harness
        values={{ ...oneJar, sizeUnitDisplay: '', sizeUnitId: null }}
        editing
      />,
    );
    const unitRequired = t('barcode.amount.sizeUnitRequired');
    // Turning packages on checks the size's unit.
    const packaged = screen.getByTestId(barcodeTestIDs.scanAmountPackaged);
    fireEvent(packaged, 'valueChange', false);
    fireEvent(packaged, 'valueChange', true);
    expect(await screen.findByText(unitRequired)).toBeTruthy();

    fireEvent.changeText(screen.getByTestId(barcodeTestIDs.scanAmountSize), '');

    await waitFor(() => expect(screen.queryByText(unitRequired)).toBeNull());
  });

  describe('the unit it is used in', () => {
    it('reads on the summary once picked', () => {
      render(<Harness values={usedInTbsp} />);
      expect(screen.getByText('Used in tbsp')).toBeTruthy();
    });

    it('leaves the summary line out until one is picked', () => {
      render(<Harness values={oneJar} />);
      expect(screen.queryByText(/^Used in/)).toBeNull();
    });

    it('is asked for when the add creates the stack', () => {
      render(<Harness values={oneJar} editing />);
      expect(screen.getByText(t('labels.usedIn'))).toBeTruthy();
      expect(screen.getByText(t('labels.usedInHint'))).toBeTruthy();
    });

    // The add restocks a held stack, which keeps its own; the edit form sets it.
    it('is not asked for a product the pantry already holds', () => {
      render(<Harness values={usedInTbsp} editing createsStack={false} />);
      expect(screen.queryByText(t('labels.usedIn'))).toBeNull();
    });
  });
});
