import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { StorePriceSection } from '../StorePriceSection';

describe('StorePriceSection', () => {
  it('reads what was last paid where and when, the usual, and the typical price here', () => {
    render(
      <StorePriceSection
        lastPaid={{
          price: '$14.30/kg',
          storeName: 'Giant Eagle',
          paidOn: 'Oct 2',
          onSale: true,
        }}
        usual="$7.69/kg"
        typical={{ price: '$9.50/kg', chainName: null }}
      />,
    );

    expect(screen.getByText('$14.30/kg')).toBeTruthy();
    expect(
      screen.getByText(
        t('barcode.price.paidAt', { store: 'Giant Eagle', date: 'Oct 2' }),
      ),
    ).toBeTruthy();
    expect(screen.getByText(t('barcode.price.onSale'))).toBeTruthy();
    expect(screen.getByText('$7.69/kg')).toBeTruthy();
    expect(screen.getByText(t('barcode.price.typicalHere'))).toBeTruthy();
  });

  it("names the chain when the price is the chain's, and leaves out what is missing", () => {
    render(
      <StorePriceSection
        lastPaid={{
          price: '$3.49/jar',
          storeName: null,
          paidOn: 'Oct 2',
          onSale: false,
        }}
        usual={null}
        typical={{ price: '$8.10/kg', chainName: 'Giant Eagle' }}
      />,
    );

    expect(screen.getByText('$3.49/jar')).toBeTruthy();
    expect(screen.getByText('Oct 2')).toBeTruthy();
    expect(
      screen.getByText(
        t('barcode.price.typicalAtChain', { chain: 'Giant Eagle' }),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(t('barcode.price.usual'))).toBeNull();
    expect(screen.queryByText(t('barcode.price.onSale'))).toBeNull();
  });

  it('shows nothing when the server has nothing', () => {
    render(<StorePriceSection lastPaid={null} usual={null} typical={null} />);

    expect(screen.queryByTestId(barcodeTestIDs.storePrices)).toBeNull();
  });
});
