import type { Translate } from '#/i18n/types';
import type { BadgeContent } from '#components/atoms/Badge';

/** How much of a recipe the pantries hold, as a card's badge. */
export const coverageBadge = (
  percent: number,
  translate: Translate,
): BadgeContent => ({
  text: translate('recipes.pantryCoverage', { percent }),
  lines: [
    {
      icon: 'checkmark-circle',
      text: translate('recipes.coveragePercent', { percent }),
      variant: 'success',
    },
  ],
});
