import { useAppStore } from '#store/useAppStore';
import { DEFAULT_CURRENCY, formatCurrency } from '#/utils/formatters/number';

/**
 * The shape every denominated field arrives in — `PantryItem.costCurrency`,
 * `PantryItemBatch.currency`, `Purchase.currency`. Only the ISO code is needed
 * to format: Intl reads the minor unit from it.
 */
export interface FigureCurrency {
  code: string;
}

/**
 * Which currency a figure is in. The API names one for a cost it recorded, and
 * that one wins — a cost paid in euros stays euros however the reader's
 * preference is set. Only an UNDENOMINATED figure falls back to the account's
 * currency, which is also what the server denominates new costs with.
 */
export function resolveCurrency(
  figureCurrency: FigureCurrency | null | undefined,
  preferred: string,
): string {
  // `||`, not `??`: an empty preference is the absence of an answer, and Intl
  // would reject it rather than fall back.
  return figureCurrency?.code || preferred || DEFAULT_CURRENCY;
}

/** The account's currency, mirrored from `UserSettings.preferredCurrency`. */
export function usePreferredCurrency(): string {
  return useAppStore(state => state.preferredCurrency) || DEFAULT_CURRENCY;
}

/**
 * Format money without naming a currency at the call site. An absent amount
 * reads as the unknown marker; a caller that would rather omit its row tests
 * the value itself.
 */
export function useMoney(): (
  amount: number | null | undefined,
  figureCurrency?: FigureCurrency | null,
) => string {
  const preferred = usePreferredCurrency();
  return (amount, figureCurrency) =>
    formatCurrency(amount, resolveCurrency(figureCurrency, preferred));
}
