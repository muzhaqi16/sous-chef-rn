import type { Translate } from '#/i18n/types';
import type { BadgeContent } from '#components/atoms/Badge';

/** How much of a recipe the pantries hold, as a card's badge; none when they hold none of it. */
export const coverageBadge = (
  percent: number,
  translate: Translate,
): BadgeContent | undefined =>
  percent > 0
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
