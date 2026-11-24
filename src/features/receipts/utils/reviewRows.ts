import type { TranslateFn } from '#/i18n';
import {
  formatQuantityDisplay,
  type UnitLabelSource,
} from '#/utils/formatQuantity';
import type {
  ReceiptReviewRow,
  ReceiptRowStatus,
} from '../hooks/useReceiptReview';
import type { ReceiptLineChoice } from '../store/receiptDraftStore';

export type ReviewSection =
  | 'toAdd'
  | 'toRecord'
  | 'pending'
  | 'toCheck'
  | 'notAdded'
  | 'added'
  | 'recorded';

// Lines that will be added first, then those only recorded, those waiting for
// a match, those with no product to add yet, those left out, and those already in.
export const REVIEW_SECTION_ORDER: readonly ReviewSection[] = [
  'toAdd',
  'toRecord',
  'pending',
  'toCheck',
  'notAdded',
  'added',
  'recorded',
];

const STATUS_SECTION: Readonly<Record<ReceiptRowStatus, ReviewSection>> = {
  add: 'toAdd',
  failed: 'toAdd',
  pending: 'pending',
  unmatched: 'toCheck',
  skipped: 'notAdded',
  added: 'added',
  queued: 'added',
};

/** A line not stocked is only recorded, before and after it goes in. */
export function reviewSectionOf(row: ReceiptReviewRow): ReviewSection {
  const section = STATUS_SECTION[row.status];
  if (!row.choice?.notStocked) return section;
  if (section === 'toAdd') return 'toRecord';
  return section === 'added' ? 'recorded' : section;
}

// While the line keeps its printed unit, the known unit it names; else what
// the user typed, as typed.
const shownUnitOf = (
  row: ReceiptReviewRow,
  choice: ReceiptLineChoice,
): UnitLabelSource =>
  row.measureUnit && choice.unitText === (row.unit ?? '')
    ? row.measureUnit
    : { symbol: choice.unitText };

const shownSizeUnitOf = (
  row: ReceiptReviewRow,
  size: NonNullable<ReceiptLineChoice['packageSize']>,
): UnitLabelSource => {
  const printed = row.packages?.size;
  return printed?.measureUnit && size.unitText === printed.unit
    ? printed.measureUnit
    : { symbol: size.unitText };
};

/** What a line says under its name: its state, or what was chosen for it. */
export function reviewRowSubtitle(
  row: ReceiptReviewRow,
  matchFailed: boolean,
  t: TranslateFn,
): string {
  const { choice } = row;
  switch (row.status) {
    case 'failed':
      return row.failure ?? t('receipts.review.notAdded');
    case 'pending':
      return matchFailed
        ? t('receipts.review.notMatchedYet')
        : t('receipts.review.findingMatch');
    case 'unmatched':
      return row.suggestion
        ? t('receipts.review.chooseSuggested', {
            name: row.suggestion.itemName,
          })
        : t('receipts.review.choose');
    case 'skipped':
      return t('receipts.review.leftOut');
    case 'add':
    case 'added':
    case 'queued': {
      if (!choice) return row.printed;
      // A bare count took its list line's amount: say so, so it can be fixed.
      if (row.fromList) {
        return t(
          choice.notStocked
            ? 'receipts.review.chosenDetailFromListNotStocked'
            : 'receipts.review.chosenDetailFromList',
          {
            printed: row.printed,
            amount: formatQuantityDisplay(
              row.fromList.quantity,
              row.fromList.unit,
            ),
          },
        );
      }
      return t(
        choice.notStocked
          ? 'receipts.review.chosenDetailNotStocked'
          : 'receipts.review.chosenDetail',
        {
          printed: row.printed,
          amount: choice.packageSize
            ? t('receipts.review.packagesAmount', {
                count: choice.quantity,
                size: formatQuantityDisplay(
                  choice.packageSize.quantity,
                  shownSizeUnitOf(row, choice.packageSize),
                ),
              })
            : formatQuantityDisplay(choice.quantity, shownUnitOf(row, choice)),
        },
      );
    }
  }
}

export function reviewSectionTitle(
  section: ReviewSection,
  count: number,
  matchFailed: boolean,
  t: TranslateFn,
): string {
  switch (section) {
    case 'toAdd':
      return t('receipts.review.sectionToAdd', { count });
    case 'toRecord':
      return t('receipts.review.sectionToRecord', { count });
    case 'pending':
      return matchFailed
        ? t('receipts.review.sectionNotMatchedYet', { count })
        : t('receipts.review.sectionMatching', { count });
    case 'toCheck':
      return t('receipts.review.sectionToCheck', { count });
    case 'notAdded':
      return t('receipts.review.sectionNotAdded', { count });
    case 'added':
      return t('receipts.review.sectionAdded', { count });
    case 'recorded':
      return t('receipts.review.sectionRecorded', { count });
  }
}
