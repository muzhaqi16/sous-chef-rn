import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import {
  PriceBasis,
  PriceComparisonScope,
} from '#/graphql/generated/schemaTypes';
import { formatCurrency } from '#/utils/formatters/number';
import { formatMonthDay } from '#/utils/formatters/date';
import { useSelectedHomeId } from '#store/useAppStore';
import {
  HouseholdPricePaidDocument,
  StorePriceComparisonDocument,
} from './useStorePriceMemory.generated';

/** The newest price the household paid, worded for the card. */
export interface LastPaidLine {
  price: string;
  storeName: string | null;
  paidOn: string;
  onSale: boolean;
}

/** The typical price at the store being shopped, else its chain. */
export interface TypicalLine {
  price: string;
  chainName: string | null;
}

function perBasis(t: Translate, basis: PriceBasis, price: string): string {
  switch (basis) {
    case PriceBasis.PerKg:
      return t('barcode.price.perKg', { price });
    case PriceBasis.PerL:
      return t('barcode.price.perL', { price });
    case PriceBasis.Each:
      return t('barcode.price.each', { price });
  }
}

/**
 * Store mode's price lines for a scanned product: what the household last paid
 * and usually pays, and what it typically costs here. Every line reads per kg,
 * L or each on one basis; a last price the server could not put on it shows
 * per its own unit. A line the server has nothing for is null. `unit` is the
 * one the price sheet counts in, which a typed price is compared in.
 */
export function useStorePriceMemory(
  itemId: string,
  listId: string | undefined,
  unit: { id: string; symbol: string } | undefined,
) {
  const { t } = useTranslation();
  const homeId = useSelectedHomeId();
  const paid = useQuery(
    HouseholdPricePaidDocument,
    listId && homeId && unit
      ? { variables: { itemId, homeId, unitId: unit.id } }
      : skipToken,
  );
  const here = useQuery(
    StorePriceComparisonDocument,
    listId ? { variables: { itemId, listId } } : skipToken,
  );

  // `skipToken` keeps the last run's answer, which may be another home's.
  const summary =
    paid.variables.homeId === homeId
      ? paid.data?.item?.householdPriceSummary
      : undefined;
  const money = (
    amount: number,
    currency: { code: string; decimalPlaces: number },
  ) => formatCurrency(amount, currency.code, currency.decimalPlaces);

  const usual = summary?.usual ?? null;
  const last = summary?.lastPaid ?? null;
  const basis = usual?.basis ?? last?.basis ?? null;

  let lastPaid: LastPaidLine | null = null;
  if (summary && last) {
    const normalized = last.normalizedPrice;
    lastPaid = {
      price:
        normalized != null && last.basis && last.basis === basis
          ? perBasis(t, last.basis, money(normalized, summary.currency))
          : t('barcode.price.perUnit', {
              price: money(last.unitPrice, summary.currency),
              unit: last.unit.symbol,
            }),
      storeName: last.store?.name ?? null,
      paidOn: formatMonthDay(new Date(last.paidAt)),
      onSale: last.onSale,
    };
  }

  const comparison = here.data?.itemPriceComparison;
  const store = here.data?.shoppingList?.targetStore;
  const rows = (comparison?.rows ?? []).filter(
    row => row.meetsMinimumSample && (basis === null || row.basis === basis),
  );
  const atStore =
    store &&
    rows.find(
      row =>
        row.scope === PriceComparisonScope.Store && row.store?.id === store.id,
    );
  const chain = store?.chain;
  const atChain =
    chain &&
    rows.find(
      row =>
        row.scope === PriceComparisonScope.Chain && row.chain?.id === chain.id,
    );
  const typicalRow = atStore ?? atChain;

  const usualPerUnit = usual?.unitPrice ?? null;
  /**
   * How a price per one of `unit` compares with the usual, to the currency's
   * smallest coin; null where the server could not put the usual on that unit.
   */
  const compareToUsual = (paidPerUnit: number): string | null => {
    if (!summary || !unit || usualPerUnit === null) return null;
    const scale = 10 ** summary.currency.decimalPlaces;
    const difference =
      Math.round(paidPerUnit * scale) - Math.round(usualPerUnit * scale);
    const usualText = t('barcode.price.perUnit', {
      price: money(usualPerUnit, summary.currency),
      unit: unit.symbol,
    });
    if (difference === 0) {
      return t('barcode.price.sameAsUsual', { usual: usualText });
    }
    const options = {
      difference: money(Math.abs(difference) / scale, summary.currency),
      usual: usualText,
    };
    return difference > 0
      ? t('barcode.price.aboveUsual', options)
      : t('barcode.price.belowUsual', options);
  };

  return {
    lastPaid,
    usual:
      summary && usual
        ? perBasis(t, usual.basis, money(usual.medianPrice, summary.currency))
        : null,
    typical:
      comparison && typicalRow
        ? {
            price: perBasis(
              t,
              typicalRow.basis,
              money(typicalRow.medianPrice, comparison.currency),
            ),
            chainName: atStore ? null : chain?.name ?? null,
          }
        : null,
    compareToUsual,
  };
}
