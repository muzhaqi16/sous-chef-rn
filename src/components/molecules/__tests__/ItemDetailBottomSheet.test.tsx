'use no memo';
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ItemDetailBottomSheet } from '../ItemDetailBottomSheet';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#components/organisms/QuantitySelector', () => {
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ quantity }: any) => <View><Text>Qty: {quantity}</Text></View>,
  };
});
jest.mock('#components/base/Button', () => ({
  Button: ({ onPress, children }: any) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={onPress}><Text>{children}</Text></Pressable>;
  },
}));
jest.mock('#generated', () => ({
  useUpdateShoppingListItemMutation: () => [jest.fn(), { loading: false }],
  useGetCommonUnitsQuery: () => ({ data: { units: [] } }),
}));
jest.mock('#/utils/compilerSafeWrappers');

describe('ItemDetailBottomSheet', () => {
  const defaultProps = {
    item: { id: '1', itemName: 'Milk' } as any,
    onClose: jest.fn(),
    onUpdate: jest.fn(),
    onRemove: jest.fn(),
  };

  it('renders with item name as default input value', () => {
    render(<ItemDetailBottomSheet {...defaultProps} />);
    expect(screen.getByDisplayValue('Milk')).toBeTruthy();
  });

  it('renders Save button', () => {
    render(<ItemDetailBottomSheet {...defaultProps} />);
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('renders quantity selector', () => {
    render(<ItemDetailBottomSheet {...defaultProps} />);
    expect(screen.getByText('Qty: 1')).toBeTruthy();
  });
});
