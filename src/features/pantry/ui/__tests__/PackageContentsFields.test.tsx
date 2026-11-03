import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PackageContentsFields } from '../PackageContentsFields';

jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () =>
  require('#/test-utils/searchResultsStubs'),
);

const renderFields = (
  overrides: Partial<React.ComponentProps<typeof PackageContentsFields>> = {},
) => {
  const onSizeChange = jest.fn();
  render(
    <PackageContentsFields
      variant="modal"
      size="10"
      onSizeChange={onSizeChange}
      unit="can"
      onUnitChange={jest.fn()}
      onUnitSelected={jest.fn()}
      sizeTestID="size"
      {...overrides}
    />,
  );
  return { onSizeChange };
};

describe('PackageContentsFields', () => {
  it('asks what each one holds', () => {
    renderFields();
    expect(screen.getByText('Each holds')).toBeTruthy();
  });

  it('passes on what is typed', () => {
    const { onSizeChange } = renderFields();
    fireEvent.changeText(screen.getByTestId('size'), '12');
    expect(onSizeChange).toHaveBeenCalledWith('12');
  });

  it('shows a refusal on its field', () => {
    renderFields({ sizeError: 'Enter a size greater than 0.' });
    expect(screen.getByText('Enter a size greater than 0.')).toBeTruthy();
  });
});
