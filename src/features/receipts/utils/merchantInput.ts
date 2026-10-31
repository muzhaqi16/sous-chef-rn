import type { ReceiptMerchantInput } from '#/graphql/generated/schemaTypes';
import type { PrintedStore } from '../store/receiptDraftStore';

// The API refuses a longer value, which would refuse the whole request.
const NAME_MAX = 255;
const ADDRESS_MAX = 255;
const STORE_NUMBER_MAX = 32;

const within = (text: string | undefined, max: number) => {
  const value = text?.trim();
  return value && value.length <= max ? value : undefined;
};

/**
 * The merchant a receipt names, as the API takes one: a value past its cap is
 * left out, as a blank one is. Null when nothing is left.
 */
export function merchantInputOf(
  printed: PrintedStore | null | undefined,
): ReceiptMerchantInput | null {
  const name = within(printed?.name, NAME_MAX);
  const address = within(printed?.address, ADDRESS_MAX);
  const storeNumber = within(printed?.storeNumber, STORE_NUMBER_MAX);
  if (!name && !address && !storeNumber) return null;
  return {
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
    ...(storeNumber ? { storeNumber } : {}),
  };
}
