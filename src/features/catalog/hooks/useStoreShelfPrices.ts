import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import { pricePerBasis } from '#/domain/money';
import { PriceBasis } from '#/graphql/generated/schemaTypes';
import { useTranslation } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { useBudgetAndPricesEnabled } from '#hooks/settings/useBudgetAndPricesEnabled';
import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { formatMonthDay } from '#/utils/formatters/date';
import { formatCurrency } from '#/utils/formatters/number';
import {
  StoreShelfPricesDocument,
  UseStoreShelfPrices_ItemFragmentDoc,
  UseStoreShelfPrices_ListFragmentDoc,
  type UseStoreShelfPrices_ItemFragment,
} from './useStoreShelfPrices.generated';
import { formatQuantityWithUnit, unitLabel } from '#/utils/formatQuantity';

/** One store's shelf price for an item, worded for its row. */
export interface StoreShelfPriceRow {
  storeId: string;
  storeName: string;
  /** What a shopper pays now, per the unit it is sold in. */
  price: string;
  /** The price per kg, L or piece, where it differs from `price`. */
  perBasis: string | null;
  /** The regular price a promotion replaces; set only on a sale. */
  wasPrice: string | null;
  usual: string | null;
  lowest: string | null;
  /** When the store last listed it; set only for a price that is not current. */
  lastSeen: string | null;
  aisle: string | null;
  isCheapest: boolean;
  isListStore: boolean;
}

/** Another product of the item's kind at one store, worded for its row. */
export interface SimilarShelfPriceRow {
  storeId: string;
  storeName: string;
  /** The product priced and its size: "Appleton Farms Bacon · 12 oz". */
  product: string;
  /** What a shopper pays now, per the unit it is sold in. */
  price: string;
  /** The price per kg, L or piece. */
  perBasis: string | null;
  /** Cheaper per kg, L or piece than the cheapest current same-product price. */
  mightBeCheaper: boolean;
}

type StorePrice =
  UseStoreShelfPrices_ItemFragment['storePricesConnection']['edges'][number]['node'];
type SimilarPrice =
  UseStoreShelfPrices_ItemFragment['similarStorePrices'][number];

// Compared to the currency's smallest coin, as a shopper reads them.
const coinsOf = (amount: number, decimalPlaces: number) =>
  Math.round(amount * 10 ** decimalPlaces);

// Prices compare only on one basis and in one currency.
const comparableKey = (basis: PriceBasis, currencyCode: string) =>
  `${basis}:${currencyCode}`;

/** The days the API's typical and lowest prices span. */
const PRICE_HISTORY_DAYS = 90;
/** Under this many days with a price, the usual and the low name their span. */
const SHORT_HISTORY_DAYS = 30;

/** Where a row stands among the others, which its own fields cannot say. */
type RowMarks = Pick<StoreShelfPriceRow, 'isCheapest' | 'isListStore'>;

function rowOf(
  node: StorePrice,
  marks: RowMarks,
  t: Translate,
): StoreShelfPriceRow {
  const { currency } = node;
  const money = (amount: number) =>
    formatCurrency(amount, currency.code, currency.decimalPlaces);
  // Compared to the currency's smallest coin, as a shopper reads them.
  const coins = (amount: number) =>
    Math.round(amount * 10 ** currency.decimalPlaces);
  const price = coins(node.price);
  const priceText = money(node.price);
  const typical = coins(node.typicalPrice);
  const normalized =
    node.normalizedPrice == null ? null : coins(node.normalizedPrice);
  const perPiece =
    node.normalizedBasis === PriceBasis.Each && normalized === price;
  const short = node.coveredDays < SHORT_HISTORY_DAYS;

  let usual: string | null = null;
  if (typical !== price) {
    const typicalText = money(node.typicalPrice);
    usual = short
      ? t('storeShelfPrices.usuallyOver', {
          price: typicalText,
          count: node.coveredDays,
        })
      : t('storeShelfPrices.usually', { price: typicalText });
  }

  return {
    storeId: node.store.id,
    storeName: node.store.name,
    price: perPiece
      ? t('labels.pricePer.each', { price: priceText })
      : t('labels.pricePer.unit', {
          price: priceText,
          unit: unitLabel(node.unit),
        }),
    perBasis:
      node.normalizedBasis &&
      node.normalizedPrice != null &&
      normalized !== price
        ? pricePerBasis(t, node.normalizedBasis, money(node.normalizedPrice))
        : null,
    wasPrice: node.onPromotion
      ? t('storeShelfPrices.was', { price: money(node.regularPrice) })
      : null,
    usual,
    lowest:
      node.isCurrent && price <= coins(node.lowestPrice) && price < typical
        ? t('storeShelfPrices.lowestIn', {
            count: short ? node.coveredDays : PRICE_HISTORY_DAYS,
          })
        : null,
    lastSeen: node.isCurrent
      ? null
      : t('storeShelfPrices.lastSeen', {
          date: formatMonthDay(new Date(node.confirmedAt)),
        }),
    aisle: firstNonBlank(node.aisle) ?? null,
    ...marks,
  };
}

function similarRowOf(
  similar: SimilarPrice,
  cheapestSame: ReadonlyMap<string, number>,
  t: Translate,
): SimilarShelfPriceRow {
  const { currency } = similar;
  const money = (amount: number) =>
    formatCurrency(amount, currency.code, currency.decimalPlaces);
  const cheapest = cheapestSame.get(
    comparableKey(similar.basis, currency.code),
  );
  const size = similar.packageNetWeight
    ? formatQuantityWithUnit(
        similar.packageNetWeight,
        similar.packageNetWeightUnit,
      )
    : null;
  return {
    storeId: similar.store.id,
    storeName: similar.store.name,
    product: [similar.product.name, size].filter(Boolean).join(' · '),
    price: t('labels.pricePer.unit', {
      price: money(similar.price),
      unit: unitLabel(similar.unit),
    }),
    perBasis: pricePerBasis(t, similar.basis, money(similar.normalizedPrice)),
    mightBeCheaper:
      cheapest !== undefined &&
      coinsOf(similar.normalizedPrice, currency.decimalPlaces) < cheapest,
  };
}

/**
 * The similar products worth showing: at a store that lacks the item, or
 * cheaper per kg, L or piece than the item there.
 */
function similarRowsOf(
  edges: UseStoreShelfPrices_ItemFragment['storePricesConnection']['edges'],
  similar: UseStoreShelfPrices_ItemFragment['similarStorePrices'],
  t: Translate,
): SimilarShelfPriceRow[] {
  const current = edges.map(({ node }) => node).filter(node => node.isCurrent);
  const cheapestSame = new Map<string, number>();
  const sameAt = new Map<string, StorePrice>();
  for (const node of current) {
    sameAt.set(node.store.id, node);
    if (!node.normalizedBasis || node.normalizedPrice == null) continue;
    const key = comparableKey(node.normalizedBasis, node.currency.code);
    const coins = coinsOf(node.normalizedPrice, node.currency.decimalPlaces);
    const held = cheapestSame.get(key);
    if (held === undefined || coins < held) cheapestSame.set(key, coins);
  }
  return similar
    .filter(row => {
      const same = sameAt.get(row.store.id);
      if (!same) return true;
      return (
        same.normalizedBasis === row.basis &&
        same.normalizedPrice != null &&
        same.currency.code === row.currency.code &&
        coinsOf(row.normalizedPrice, row.currency.decimalPlaces) <
          coinsOf(same.normalizedPrice, same.currency.decimalPlaces)
      );
    })
    .map(row => similarRowOf(row, cheapestSame, t));
}

/** Whether a host shows its prices section: any store priced either way. */
export const hasShelfPrices = (prices: {
  rows: readonly unknown[];
  similarRows: readonly unknown[];
}): boolean => prices.rows.length > 0 || prices.similarRows.length > 0;

/**
 * An item's shelf price at each store that collected one, in the server's
 * order: current prices cheapest first, then the stale; then another product
 * of its kind at each of the household's stores, where it lacks the item or
 * costs less per unit. Nothing is asked or shown without a list, with Budget
 * & prices off, or with the build's `storeShelfPrices` off. The list's store
 * is tagged when the list names one.
 */
export function useStoreShelfPrices(
  itemId: string | undefined,
  listId: string | null | undefined,
) {
  const { t } = useTranslation();
  const offered = useFeatureFlag('storeShelfPrices');
  const pricesShown = useBudgetAndPricesEnabled();
  const subject =
    offered && pricesShown && itemId && listId ? { itemId, listId } : null;
  // A store-mode scan's lookup stores these with the item, so this asks only
  // for an item that came another way.
  useQuery(
    StoreShelfPricesDocument,
    subject
      ? { variables: { itemId: subject.itemId }, fetchPolicy: 'cache-first' }
      : skipToken,
  );
  const item = useFragment({
    fragment: UseStoreShelfPrices_ItemFragmentDoc,
    fragmentName: 'useStoreShelfPrices_item',
    from: subject ? { __typename: 'Item', id: subject.itemId } : null,
  });
  const list = useFragment({
    fragment: UseStoreShelfPrices_ListFragmentDoc,
    fragmentName: 'useStoreShelfPrices_list',
    from: subject ? { __typename: 'ShoppingList', id: subject.listId } : null,
  });

  const edges = item.complete ? item.data.storePricesConnection.edges : [];
  const listStoreId = list.complete ? list.data.targetStore?.id : undefined;
  return {
    similarRows: item.complete
      ? similarRowsOf(edges, item.data.similarStorePrices, t)
      : [],
    rows: edges.map(({ node }, index) =>
      rowOf(
        node,
        {
          // The server ranks current prices first, so a stale first row means
          // none is current.
          isCheapest: index === 0 && node.isCurrent && edges.length > 1,
          isListStore: node.store.id === listStoreId,
        },
        t,
      ),
    ),
  };
}
