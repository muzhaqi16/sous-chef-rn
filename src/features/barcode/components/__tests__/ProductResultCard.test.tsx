'use no memo';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { barcodeTestIDs } from '#features/barcode/testIDs';
import { ProductResultCard } from '../ProductResultCard';
import type { ReadingSystem } from '#domain/measure';
import {
  NetWeightKind,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: ({ uri }: { uri: string }) => {
    const { View } = require('react-native');
    return <View testID="cached-image" accessibilityHint={uri} />;
  },
}));

describe('ProductResultCard', () => {
  const baseItem = {
    id: '1',
    name: 'Organic Milk',
    upc: '123456789',
  };

  it('renders item name and barcode', () => {
    render(
      <ProductResultCard readingSystem={UnitSystem.Metric} item={baseItem} />,
    );
    expect(screen.getByText('Organic Milk')).toBeTruthy();
    expect(screen.getByText('Barcode: 123456789')).toBeTruthy();
  });

  it('renders brand name when provided', () => {
    render(
      <ProductResultCard
        readingSystem={UnitSystem.Metric}
        item={{ ...baseItem, brandName: 'Horizon' }}
      />,
    );
    expect(screen.getByText('Horizon')).toBeTruthy();
  });

  it('renders price when provided', () => {
    render(
      <ProductResultCard
        readingSystem={UnitSystem.Metric}
        item={{ ...baseItem, price: 4.99 }}
      />,
    );
    expect(screen.getByText('$4.99')).toBeTruthy();
  });

  // Only a package figure is the pack's size; a serving shown bare would read
  // as one and be taken for the package.
  it('shows a package figure as the size', () => {
    render(
      <ProductResultCard
        readingSystem={UnitSystem.Metric}
        item={{
          ...baseItem,
          netWeight: 500,
          netWeightKind: NetWeightKind.Package,
          displayUnit: { name: 'g' },
        }}
      />,
    );
    expect(screen.getByText('500 g')).toBeTruthy();
  });

  // A 3 LB (1.36 kg) honey reads as its label does in each unit system, never
  // as the grams the catalog stores.
  it.each<[ReadingSystem, string]>([
    [UnitSystem.Imperial, '3 lb'],
    [UnitSystem.Metric, '1.36 kg'],
  ])('shows the pack size in the user’s unit system (%s)', (system, text) => {
    const reading = (value: number, symbol: string) => ({
      value,
      symbol,
      displayAsFraction: false,
      type: UnitType.Weight,
    });
    render(
      <ProductResultCard
        readingSystem={system}
        item={{
          ...baseItem,
          netWeight: 1360.78,
          netWeightKind: NetWeightKind.Package,
          displayUnit: { name: 'gram', symbol: 'g' },
          packageSize: {
            metric: reading(1.36, 'kg'),
            imperial: reading(3, 'lb'),
          },
        }}
      />,
    );
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByText(/gram/)).toBeNull();
  });

  it('labels a serving figure as a serving', () => {
    render(
      <ProductResultCard
        readingSystem={UnitSystem.Metric}
        item={{
          ...baseItem,
          netWeight: 30,
          netWeightKind: NetWeightKind.Serving,
          displayUnit: { name: 'g' },
        }}
      />,
    );
    expect(screen.getByText('One serving: 30 g')).toBeTruthy();
  });

  it('renders format when provided', () => {
    render(
      <ProductResultCard
        readingSystem={UnitSystem.Metric}
        item={baseItem}
        format="UPC-A"
      />,
    );
    expect(screen.getByText('UPC-A')).toBeTruthy();
  });

  it('shows its image, credited under it', () => {
    render(
      <ProductResultCard
        readingSystem={UnitSystem.Metric}
        item={{
          ...baseItem,
          image: {
            url: 'https://cdn.test/front.jpg',
            credit: {
              text: 'Open Food Facts',
              license: 'CC BY-SA 3.0',
              licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
              sourceUrl: 'https://world.openfoodfacts.org/product/1',
            },
          },
        }}
      />,
    );
    expect(screen.getByTestId('cached-image').props.accessibilityHint).toBe(
      'https://cdn.test/front.jpg',
    );
    expect(screen.getByText('Photo: Open Food Facts')).toBeTruthy();
  });

  it('shows no credit for an image that needs none', () => {
    render(
      <ProductResultCard
        readingSystem={UnitSystem.Metric}
        item={{ ...baseItem, image: { url: 'https://cdn.test/front.jpg' } }}
      />,
    );
    expect(screen.queryByText(/^Photo:/)).toBeNull();
  });
  describe("the user's brand lists, at the brand", () => {
    const jif = { ...baseItem, brandName: 'Jif' };

    it('names each list the brand is on, the parent it went through and the note', () => {
      render(
        <ProductResultCard
          readingSystem={UnitSystem.Metric}
          item={jif}
          brandLists={{
            listings: [
              {
                key: 'a',
                listName: 'Boycott',
                viaParent: 'Smucker',
                reason: 'parent company',
              },
            ],
            onAddToList: jest.fn(),
          }}
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
        <ProductResultCard
          readingSystem={UnitSystem.Metric}
          item={jif}
          brandLists={{ listings: [], onAddToList }}
        />,
      );

      expect(screen.queryByTestId(barcodeTestIDs.brandListings)).toBeNull();
      fireEvent.press(
        screen.getByLabelText(
          t('barcode.brandLists.addToList', { brand: 'Jif' }),
        ),
      );
      expect(onAddToList).toHaveBeenCalled();
    });

    it('offers no add for a product with no brand of its own', () => {
      render(
        <ProductResultCard readingSystem={UnitSystem.Metric} item={jif} />,
      );

      expect(screen.queryByTestId(barcodeTestIDs.addBrandToList)).toBeNull();
    });
  });
});
