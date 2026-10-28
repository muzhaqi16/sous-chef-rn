import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { ProductOriginSection } from '../ProductOriginSection';

describe('ProductOriginSection', () => {
  it('shows each fact with its source, and none for a fact without one', () => {
    render(
      <ProductOriginSection
        lines={[
          { key: 'made', text: 'Made in Canada', source: 'Open Food Facts' },
          { key: 'owner', text: 'Part of General Mills', source: null },
        ]}
      />,
    );

    expect(screen.getByText('Made in Canada')).toBeTruthy();
    expect(
      screen.getByText(
        t('barcode.origin.sourceLabel', { source: 'Open Food Facts' }),
      ),
    ).toBeTruthy();
    expect(screen.getByText('Part of General Mills')).toBeTruthy();
    expect(screen.getAllByText(/Open Food Facts/)).toHaveLength(1);
  });

  it('shows no section when the records state nothing', () => {
    render(<ProductOriginSection lines={[]} />);

    expect(screen.queryByTestId(barcodeTestIDs.productOrigin)).toBeNull();
  });
});
