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
