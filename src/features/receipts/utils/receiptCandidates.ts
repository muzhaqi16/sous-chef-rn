import type { ReceiptCandidate } from '../hooks/useReceiptMatches';

/**
 * The detail a candidate's chip shows beside its name: only when another
 * candidate has the same name, so two brands of whole milk read apart.
 */
export function detailBesideName(
  candidate: ReceiptCandidate,
  candidates: readonly ReceiptCandidate[],
): string | null {
  const sharesItsName = candidates.some(
    other =>
      other.itemId !== candidate.itemId &&
      other.itemName === candidate.itemName,
  );
  return sharesItsName ? candidate.detail : null;
}
