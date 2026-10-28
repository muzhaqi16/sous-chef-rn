import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import {
  type PriceBasis,
  PriceComparisonScope,
} from '#/graphql/generated/schemaTypes';
import { pricePerBasis } from '#/domain/money';
import { formatCurrency } from '#/utils/formatters/number';
import { formatMonthDay } from '#/utils/formatters/date';
import { useSelectedHomeId } from '#store/useAppStore';
import {
  HouseholdPricePaidDocument,
  HouseholdUsualUnitPriceDocument,
  StorePriceComparisonDocument,
  UseStorePriceMemory_ItemFragmentDoc,
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

// A basis this build predates: the price alone, never a blank label.
function perBasis(t: Translate, basis: PriceBasis, price: string): string {
  return pricePerBasis(t, basis, price) ?? price;
}

/**
 * Store mode's price lines for a scanned product: what the household last paid
 * and usually pays, and what it typically costs here. Every line reads per kg,
 * L or each on one basis; a last price the server could not put on it shows
 * per its own unit. A line the server has nothing for is null. `unit` and
 * `recordsIn` are what the price sheet counts in and the currency it records,
 * which a typed price is compared in.
 */
export function useStorePriceMemory(
  itemId: string,
  listId: string | undefined,
  unit: { id: string; symbol: string } | undefined,
  recordsIn: string,
) {
  const { t } = useTranslation();
  const homeId = useSelectedHomeId();
  const shown = listId && homeId ? homeId : null;
  // The scan's lookup stores these with the item in store mode, so this asks
  // only for an item that came another way.
  useQuery(
    HouseholdPricePaidDocument,
    shown
      ? { variables: { itemId, homeId: shown }, fetchPolicy: 'cache-first' }
      : skipToken,
  );
  const paid = useFragment({
    fragment: UseStorePriceMemory_ItemFragmentDoc,
    fragmentName: 'useStorePriceMemory_item',
    from: shown ? { __typename: 'Item', id: itemId } : null,
    variables: { homeId: shown ?? '' },
  });
  const summary = paid.complete ? paid.data.householdPriceSummary : undefined;
  // A list line counting in a unit of its own: the usual per one of that.
  const ownUnit =
    paid.complete && unit && unit.id !== paid.data.usualUnit.id
      ? unit
      : undefined;
  const ownUnitPrice = useQuery(
    HouseholdUsualUnitPriceDocument,
    shown && ownUnit
      ? {
          variables: { itemId, homeId: shown, unitId: ownUnit.id },
          fetchPolicy: 'cache-first',
        }
      : skipToken,
  );
  const here = useQuery(
    StorePriceComparisonDocument,
    listId
      ? { variables: { itemId, listId }, fetchPolicy: 'cache-first' }
      : skipToken,
  );
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
          : t('labels.pricePer.unit', {
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

  // `skipToken` keeps the last run's answer, which may be another unit's.
  const asked = ownUnitPrice.variables;
  const ownUsual =
    ownUnit && asked.unitId === ownUnit.id && asked.homeId === shown
      ? ownUnitPrice.data?.item?.householdPriceSummary.usual?.unitPrice
      : undefined;
  const usualPerUnit = (ownUnit ? ownUsual : usual?.unitPrice) ?? null;
  /**
   * How a price per one of `unit` compares with the usual, to the currency's
   * smallest coin; null where the server could not put the usual on that unit.
   */
  const compareToUsual = (paidPerUnit: number): string | null => {
    if (!summary || !unit || usualPerUnit === null) return null;
    // The usual is in the caller's currency, the typed price in the list's.
    if (summary.currency.code !== recordsIn) return null;
    const scale = 10 ** summary.currency.decimalPlaces;
    const difference =
      Math.round(paidPerUnit * scale) - Math.round(usualPerUnit * scale);
    const usualText = t('labels.pricePer.unit', {
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
