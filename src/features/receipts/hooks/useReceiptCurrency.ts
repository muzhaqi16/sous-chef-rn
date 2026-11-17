import { useMoney } from '#domain/money';
import { useReceiptDraft } from '../store/receiptDraftStore';

/**
 * The currency the receipt prints, sent as read: the API books the receipt in
 * it. Undefined where the reading decided none.
 */
export function useReceiptCurrency(): string | undefined {
  return useReceiptDraft()?.parsed?.currency;
}

/** Formats the receipt's figures in the currency it prints, else the account's. */
export function useReceiptMoney(): (
  amount: number | null | undefined,
) => string {
  const money = useMoney();
  const currency = useReceiptCurrency();
  return amount => money(amount, currency ? { code: currency } : null);
}
