import { useMutation, useQuery } from '@apollo/client/react';
import { UpdateUserPreferencesDocument } from '#operations/auth/user.generated';
import { GetCurrenciesDocument } from '#features/profile/graphql/currency.generated';
import { useAppStore, useUpdateUser } from '#store/useAppStore';
import { usePreferredCurrency } from '#/domain/money';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';

export interface CurrencyOption {
  value: string;
  label: string;
}

/**
 * The settings' own currency (`updateSettings { regional }`), which the server
 * denominates an unnamed cost from. The write is NOT `localFirst`: queued, the
 * money on screen would read in a currency the account does not hold.
 */
export function useCurrencyPreference() {
  const { t } = useTranslation();
  const preferredCurrency = usePreferredCurrency();
  const setPreferredCurrency = useAppStore(state => state.setPreferredCurrency);
  const { data } = useQuery(GetCurrenciesDocument);
  const updateUser = useUpdateUser();
  const [updateSettings] = useMutation(UpdateUserPreferencesDocument);

  const options: CurrencyOption[] = (data?.currencies ?? []).map(currency => ({
    value: currency.code,
    // Deliberately unlocalized: a currency's name and symbol are its own, and
    // the code disambiguates the dollars and the kronor from each other.
    label: `${currency.code} — ${currency.name} (${currency.symbol})`,
  }));

  // The picker needs the full name to tell two dollars apart; a settings row
  // has one line beside its label, where the name only truncates.
  const selected = data?.currencies.find(c => c.code === preferredCurrency);
  const currentLabel = selected
    ? `${selected.code} (${selected.symbol})`
    : preferredCurrency;

  const writeCurrency = async (code: string): Promise<boolean> => {
    const previous = preferredCurrency;
    // Ahead of the round trip so the money on screen re-denominates at once;
    // reverted if the write fails.
    setPreferredCurrency(code);

    const settled = await settleMutation(
      () =>
        updateSettings({
          variables: { input: { regional: { preferredCurrency: code } } },
        }),
      {
        document: UpdateUserPreferencesDocument,
        fallback: t('settings.updateFailed'),
        onFailed: () => setPreferredCurrency(previous),
      },
    );
    if (settled.status === 'failed') return false;
    // The persisted record follows: at the next launch it wins over the mirror.
    updateUser({ preferredCurrency: code });
    return true;
  };

  /**
   * Confirmed, because the change is not retroactive: recorded costs keep their
   * currency, so a pantry can span two and the API withholds its value rather
   * than summing across them.
   */
  const selectCurrency = (code: string): void => {
    if (code === preferredCurrency) return;
    alertService.alert(
      t('labels.currency'),
      t('settings.currencyKeepsExisting'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.confirm'),
          onPress: () => {
            writeCurrency(code).catch(() => {
              // writeCurrency reverts and alerts on its own; nothing to add.
            });
          },
        },
      ],
    );
  };

  return { preferredCurrency, currentLabel, options, selectCurrency };
}
