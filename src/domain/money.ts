import { PriceBasis } from '#/graphql/generated/schemaTypes';
import type { Translate } from '#/i18n/types';
import { useAppStore } from '#store/useAppStore';
import { DEFAULT_CURRENCY, formatCurrency } from '#/utils/formatters/number';
import { firstNonBlank } from '#/utils/firstNonBlank';

/**
 * The shape of every denominated field (`PantryItem.costCurrency`,
 * `Purchase.currency`, …); Intl reads the minor unit from the code alone.
 */
export interface FigureCurrency {
  code: string;
}

/**
 * A figure's own currency wins: a cost paid in euros stays euros. Only an
 * UNDENOMINATED figure falls back to the account's, which the server also
 * denominates new costs with.
 */
export function resolveCurrency(
  figureCurrency: FigureCurrency | null | undefined,
  preferred: string,
): string {
  // Intl rejects a blank code rather than falling back.
  return firstNonBlank(figureCurrency?.code, preferred) ?? DEFAULT_CURRENCY;
}

/**
 * Amounts in different currencies are never summed. Undefined when there are
 * none, which a caller shows as unknown or omits, never as zero.
 */
export function moneyByCurrency(
  amounts: readonly { currencyCode: string; amount: number }[],
): string | undefined {
  if (amounts.length === 0) return undefined;
  return amounts
    .map(({ currencyCode, amount }) => formatCurrency(amount, currencyCode))
    .join(' · ');
}

/** The account's currency, mirrored from `UserSettings.preferredCurrency`. */
export function usePreferredCurrency(): string {
  return useAppStore(state => state.preferredCurrency) || DEFAULT_CURRENCY;
}

/**
 * An absent amount reads as the unknown marker; a caller that would rather omit
 * its row tests the value itself.
 */
export function useMoney(): (
  amount: number | null | undefined,
  figureCurrency?: FigureCurrency | null,
) => string {
  const preferred = usePreferredCurrency();
  return (amount, figureCurrency) =>
    formatCurrency(amount, resolveCurrency(figureCurrency, preferred));
}

/**
 * A formatted price per kilogram, litre or piece; null for a basis this build
 * predates, which the caller shows without one rather than as a blank label.
 */
export function pricePerBasis(
  t: Translate,
  basis: PriceBasis,
  price: string,
): string | null {
  switch (basis) {
    case PriceBasis.PerKg:
      return t('labels.pricePer.kg', { price });
    case PriceBasis.PerL:
      return t('labels.pricePer.l', { price });
    case PriceBasis.Each:
      return t('labels.pricePer.each', { price });
    default:
      return null;
  }
}
