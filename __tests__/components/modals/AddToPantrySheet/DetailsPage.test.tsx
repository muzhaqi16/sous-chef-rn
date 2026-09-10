'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { DetailsPage } from '#features/pantry/components/modals/AddToPantrySheet/DetailsPage';

jest.mock('../../../../src/apollo/links/tokenScheduler');
jest.mock('../../../../src/apollo/links/refreshToken');

jest.mock('../../../../src/components/atoms/BottomSheetKeyboardAwareScrollView', () => ({
  BottomSheetKeyboardAwareScrollView: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => children,
}));
jest.mock('../../../../src/components/atoms/FormInput', () => ({
  FormInput: (props: { label?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('../../../../src/components/molecules/EditableCounter', () => ({
  EditableCounter: (props: { label?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('#features/catalog/ui/autocomplete/UnitAutocompleteField', () => ({
  UnitAutocompleteField: (props: { label?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.label}</Text>;
  },
}));
jest.mock('../../../../src/components/atoms/FieldRow', () => ({
  FieldRow: ({ children }: { children?: React.ReactNode }) => children,
}));

describe('DetailsPage', () => {
  const defaultProps = {
    quantityInput: '1',
    setQuantityInput: jest.fn(),
    unit: '',
    setUnit: jest.fn(),
    handleUnitSelected: jest.fn(),
    pantryNetWeight: '',
    setPantryNetWeight: jest.fn(),
    pantryNetWeightUnit: '',
    setPantryNetWeightUnit: jest.fn(),
    handlePantryNetWeightUnitSelected: jest.fn(),
    showPackageDetails: false,
    setShowPackageDetails: jest.fn(),
    packageSize: '',
    setPackageSize: jest.fn(),
    contentUnit: '',
    setContentUnit: jest.fn(),
    handleContentUnitSelected: jest.fn(),
    itemNetWeight: '',
    setItemNetWeight: jest.fn(),
    weightUnit: '',
    setWeightUnit: jest.fn(),
    handleWeightUnitSelected: jest.fn(),
    insets: { bottom: 0 },
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<DetailsPage {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders Quantity field', () => {
    const { getByText } = render(<DetailsPage {...defaultProps} />);
    expect(getByText('Quantity')).toBeTruthy();
  });

  it('renders Net Weight field', () => {
    const { getByText } = render(<DetailsPage {...defaultProps} />);
    expect(getByText('Net Weight')).toBeTruthy();
  });

  it('shows Add Package Details toggle', () => {
    const { getByText } = render(<DetailsPage {...defaultProps} />);
    expect(getByText('Add Package Details')).toBeTruthy();
  });

  it('shows package details fields when expanded', () => {
    const { getByText } = render(
      <DetailsPage {...defaultProps} showPackageDetails={true} />,
    );
    expect(getByText('Qty per Package')).toBeTruthy();
  });
});
