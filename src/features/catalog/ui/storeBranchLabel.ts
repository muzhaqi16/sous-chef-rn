import type { Translate } from '#/i18n/types';
import { firstNonBlank } from '#/utils/firstNonBlank';

interface StorePlace {
  address?: string | null;
  storeNumber?: string | null;
}

/** Which branch of a chain a store is: its address, else its store number. */
export const storeBranchLabel = (
  { address, storeNumber }: StorePlace,
  translate: Translate,
): string | undefined => {
  const where = firstNonBlank(address);
  if (where) return where;
  return storeNumber
    ? translate('storeBranch.number', { number: storeNumber })
    : undefined;
};
