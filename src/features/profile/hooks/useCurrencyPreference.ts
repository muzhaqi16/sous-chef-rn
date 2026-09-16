import { useMutation, useQuery } from '@apollo/client/react';
import { UpdateAccountDocument } from '#operations/auth/user.generated';
import { GetCurrenciesDocument } from '#features/profile/graphql/currency.generated';
import { useAppStore } from '#store/useAppStore';
import { usePreferredCurrency } from '#/domain/money';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';

export interface CurrencyOption {
  value: string;
  label: string;
}

/**
 * The account's currency: the option list, the current code, and the write.
 * `updateAccount`, NOT `updateSettings` — the server denominates an unnamed
 * cost from `User.preferredCurrency`, so writing the `UserSettings` column of
 * the same name moves a value nothing reads.
 */
export function useCurrencyPreference() {
  const { t } = useTranslation();
  const preferredCurrency = usePreferredCurrency();
  const setPreferredCurrency = useAppStore(state => state.setPreferredCurrency);
  const { data } = useQuery(GetCurrenciesDocument);
  const [updateAccount] = useMutation(UpdateAccountDocument);

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
        updateAccount({ variables: { input: { preferredCurrency: code } } }),
      {
        document: UpdateAccountDocument,
        fallback: t('settings.updateFailed'),
        onFailed: () => setPreferredCurrency(previous),
      },
    );
    return settled.status !== 'failed';
  };

  /**
   * Confirmed, because the change is not retroactive: costs already recorded
   * keep their own currency, so a pantry can end up spanning two and the API
   * withholds its value rather than summing across them. Said here, where the
   * decision is made, rather than discovered later on a blank total.
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
