'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { ConsumePantryItemModal } from '../../../src/components/modals/ConsumePantryItemModal';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/components/modals/PantryActionModal', () => ({
  PantryActionModal: (props: any) => {
    const { Text, View } = require('react-native');
    return (
      <View>
        <Text>{props.title}</Text>
        <Text>{props.confirmLabel}</Text>
      </View>
    );
  },
}));
jest.mock('../../../src/components/molecules/FractionInput', () => ({
  FractionInput: () => null,
}));
jest.mock('../../../src/components/molecules/FormInput', () => ({
  FormInput: () => null,
}));

describe('ConsumePantryItemModal', () => {
  const defaultProps = {
    visible: true,
    pantryItem: {
      id: 'pi1',
      itemName: 'Milk',
      quantity: 2,
      unit: { id: 'u1', name: 'gallons', symbol: 'gal', displayAsFraction: false },
      item: null,
      remainingNetWeight: null,
      netWeightUnit: null,
      netWeight: null,
      packageBreakdown: null,
    } as any,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<ConsumePantryItemModal {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows Consume Item title', () => {
    const { getByText } = render(<ConsumePantryItemModal {...defaultProps} />);
    expect(getByText('Consume Item')).toBeTruthy();
  });

  it('shows Confirm button label', () => {
    const { getByText } = render(<ConsumePantryItemModal {...defaultProps} />);
    expect(getByText('Confirm')).toBeTruthy();
  });

  it('renders with null pantryItem', () => {
    const { toJSON } = render(
      <ConsumePantryItemModal {...defaultProps} pantryItem={null} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
