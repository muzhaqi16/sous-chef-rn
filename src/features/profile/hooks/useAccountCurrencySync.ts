import { useEffect } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';
import { GetCurrenciesDocument } from '#features/profile/graphql/currency.generated';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useUser } from '#store/useAppStore';
import { useStore } from '#store';

/**
 * Keeps this device's money in the currency the account's settings hold, at
 * each currency's precision. No live event carries a settings write, so one
 * made on another device arrives when the resync re-reads these app-wide
 * queries.
 */
export function useAccountCurrencySync(): void {
  const user = useUser();
  const { data } = useQuery(
    GetUserSettingsDocument,
    user?.id ? { fetchPolicy: 'cache-first' } : skipToken,
  );
  const currency = data?.me?.settings?.preferredCurrency;
  const table = useQuery(
    GetCurrenciesDocument,
    user?.id ? { fetchPolicy: 'cache-first' } : skipToken,
  );
  useApolloErrorLogger(GetCurrenciesDocument, table.error);
  const currencies = table.data?.currencies;

  useEffect(() => {
    if (!currencies) return;
    const decimals = Object.fromEntries(
      currencies.map(({ code, decimalPlaces }) => [code, decimalPlaces]),
    );
    const store = useStore.getState();
    // Every money surface reads the table, so an unchanged answer writes nothing.
    if (!sameDecimals(store.currencyDecimals, decimals)) {
      store.setCurrencyDecimals(decimals);
    }
  }, [currencies]);

  // Keyed on the server's value alone: a pick in flight moves the mirror ahead
  // of it (`useCurrencyPreference`), and reacting to that would undo the pick.
  useEffect(() => {
    if (!currency) return;
    const store = useStore.getState();
    if (store.preferredCurrency !== currency) {
      store.setPreferredCurrency(currency);
    }
    // The persisted record follows: at the next launch it wins over the mirror.
    if (store.user && store.user.preferredCurrency !== currency) {
      store.updateUser({ preferredCurrency: currency });
    }
  }, [currency]);
}

const sameDecimals = (
  held: Record<string, number>,
  answer: Record<string, number>,
) =>
  Object.keys(held).length === Object.keys(answer).length &&
  Object.entries(answer).every(([code, places]) => held[code] === places);
