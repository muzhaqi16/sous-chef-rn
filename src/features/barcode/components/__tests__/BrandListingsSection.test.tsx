import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { BrandListingsSection } from '../BrandListingsSection';

describe('BrandListingsSection', () => {
  it('names each list the brand is on, the parent it went through and the note', () => {
    render(
      <BrandListingsSection
        listings={[
          {
            key: 'a',
            listName: 'Boycott',
            viaParent: 'Smucker',
            reason: 'parent company',
          },
        ]}
        brandName="Jif"
        onAddToList={jest.fn()}
      />,
    );

    expect(
      screen.getByText(t('barcode.brandLists.onList', { list: 'Boycott' })),
    ).toBeTruthy();
    expect(
      screen.getByText(
        t('barcode.brandLists.viaParent', { parent: 'Smucker' }),
      ),
    ).toBeTruthy();
    expect(screen.getByText('parent company')).toBeTruthy();
  });

  it('says nothing about an unlisted brand, and offers to add it', () => {
    const onAddToList = jest.fn();
    render(
      <BrandListingsSection
        listings={[]}
        brandName="Jif"
        onAddToList={onAddToList}
      />,
    );

    expect(screen.queryByTestId(barcodeTestIDs.brandListings)).toBeNull();
    fireEvent.press(
      screen.getByText(t('barcode.brandLists.addToList', { brand: 'Jif' })),
    );
    expect(onAddToList).toHaveBeenCalled();
  });

  it('offers no add for a product with no brand of its own', () => {
    render(
      <BrandListingsSection
        listings={[]}
        brandName={null}
        onAddToList={jest.fn()}
      />,
    );

    expect(screen.queryByTestId(barcodeTestIDs.addBrandToList)).toBeNull();
  });
});
