import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { StockSettingsPage } from '../StockSettingsPage';

jest.mock('#hooks/settings/useBudgetAndPricesEnabled', () => ({
  useBudgetAndPricesEnabled: jest.fn(() => true),
}));
jest.mock('#components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: { children?: React.ReactNode }) =>
    children,
}));
jest.mock('#components/atoms/FormInput', () => ({
  FormInput: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));
jest.mock('#features/catalog/ui/autocomplete/StoreAutocompleteField', () => ({
  StoreAutocompleteField: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));

const props: React.ComponentProps<typeof StockSettingsPage> = {
  minQuantity: '',
  setMinQuantity: jest.fn(),
  restockQuantity: '',
  setRestockQuantity: jest.fn(),
  storeName: '',
  setStoreName: jest.fn(),
  handleStoreSelected: jest.fn(),
  costPerUnit: '',
  setCostPerUnit: jest.fn(),
  acquisitionMethod: AcquisitionMethod.Purchased,
  setAcquisitionMethod: jest.fn(),
  insets: { bottom: 0 },
};

describe('StockSettingsPage', () => {
  afterEach(() => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(true);
  });

  it('asks what the item cost per unit with budget & prices on', () => {
    render(<StockSettingsPage {...props} />);

    expect(screen.getByText('Cost per unit')).toBeTruthy();
    expect(screen.getByText('Store')).toBeTruthy();
  });

  it('asks for no cost with budget & prices off, and keeps the rest of the purchase', () => {
    jest.mocked(useBudgetAndPricesEnabled).mockReturnValue(false);
    render(<StockSettingsPage {...props} />);

    expect(screen.queryByText('Cost per unit')).toBeNull();
    expect(screen.getByText('Store')).toBeTruthy();
    expect(screen.getByText('How acquired')).toBeTruthy();
    expect(screen.getByText('Alert When Below')).toBeTruthy();
  });
});
