import React from 'react';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { t } from '#/i18n';
import type { StoreShelfPriceRow } from '#features/catalog/hooks/useStoreShelfPrices';
import { catalogTestIDs } from '#features/catalog/testIDs';
import { StoreShelfPriceList } from '../StoreShelfPriceList';

const row = (
  storeId: string,
  overrides: Partial<StoreShelfPriceRow> = {},
): StoreShelfPriceRow => ({
  storeId,
  storeName: `Store ${storeId}`,
  price: '$2.49/lb',
  perBasis: null,
  wasPrice: null,
  usual: null,
  lowest: null,
  lastSeen: null,
  aisle: null,
  isCheapest: false,
  isListStore: false,
  ...overrides,
});

const rowsOf = (count: number) =>
  Array.from({ length: count }, (_, index) => row(`s${index + 1}`));

const shownStores = () =>
  rowsOf(10)
    .map(({ storeId }) => storeId)
    .filter(storeId =>
      screen.queryByTestId(catalogTestIDs.storeShelfPrice(storeId)),
    );

describe('StoreShelfPriceList', () => {
  it('shows three stores of five, and the rest on request', () => {
    render(<StoreShelfPriceList rows={rowsOf(5)} />);
    expect(shownStores()).toEqual(['s1', 's2', 's3']);

    fireEvent.press(
      screen.getByText(t('storeShelfPrices.showMore', { count: 2 })),
    );

    expect(shownStores()).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(
      screen.queryByTestId(catalogTestIDs.storeShelfPricesShowMore),
    ).toBeNull();
  });

  it('shows three stores with no control', () => {
    render(<StoreShelfPriceList rows={rowsOf(3)} />);
    expect(shownStores()).toEqual(['s1', 's2', 's3']);
    expect(
      screen.queryByTestId(catalogTestIDs.storeShelfPricesShowMore),
    ).toBeNull();
  });

  it('reads a row: store, aisle, price and its notes', () => {
    render(
      <StoreShelfPriceList
        rows={[
          row('s1', {
            storeName: 'Kroger - Weirton',
            aisle: 'Aisle 12',
            price: '$1.29/lb',
            perBasis: '$2.84/kg',
            usual: 'Usually $1.49',
            lastSeen: 'Last seen Oct 16',
          }),
        ]}
      />,
    );
    const shown = within(
      screen.getByTestId(catalogTestIDs.storeShelfPrice('s1')),
    );
    for (const text of [
      'Kroger - Weirton',
      'Aisle 12',
      '$1.29/lb',
      '$2.84/kg',
      'Usually $1.49',
      'Last seen Oct 16',
    ]) {
      expect(shown.getByText(text)).toBeTruthy();
    }
  });

  it('marks each badge on its own row only', () => {
    render(
      <StoreShelfPriceList
        rows={[
          row('s1', { isCheapest: true }),
          row('s2', { wasPrice: 'was $2.99' }),
          row('s3', { isListStore: true }),
        ]}
      />,
    );
    const badgesOf = (storeId: string) => {
      const shown = within(
        screen.getByTestId(catalogTestIDs.storeShelfPrice(storeId)),
      );
      return [
        t('storeShelfPrices.cheapest'),
        t('storeShelfPrices.sale'),
        t('storeShelfPrices.listStore'),
      ].filter(badge => shown.queryByText(badge));
    };

    expect(badgesOf('s1')).toEqual([t('storeShelfPrices.cheapest')]);
    expect(badgesOf('s2')).toEqual([t('storeShelfPrices.sale')]);
    expect(badgesOf('s3')).toEqual([t('storeShelfPrices.listStore')]);
    expect(screen.getByText('was $2.99')).toBeTruthy();
  });
});
