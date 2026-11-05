import type { Translate } from '#/i18n/types';
import type { BadgeContent } from '#components/atoms/Badge';
import { READY_COVERAGE } from '#domain/recipeCoverage';

/**
 * How much of a recipe the pantries hold, as a card's badge: only on a recipe
 * ready to cook, so a thin match never reads as a success.
 */
export const coverageBadge = (
  percent: number,
  translate: Translate,
): BadgeContent | undefined =>
  percent >= READY_COVERAGE
    ? {
        text: translate('recipes.pantryCoverage', { percent }),
        lines: [
          {
            icon: 'checkmark-circle',
            text: translate('recipes.coveragePercent', { percent }),
            variant: 'success',
          },
        ],
      }
    : undefined;
