import React from 'react';
import { useTranslation } from '#/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '#components/molecules/EmptyState';
import { getTabBarBottomPadding } from '#constants/layout';
import { formatFullWeekdayMonthDay } from '#/utils/formatters/date';

interface EmptyDayStateProps {
  selectedDate: Date;
  /** Whether the reader can edit the plan; only then does it point to the +. */
  canAdd: boolean;
}

/** A day with nothing planned. The tab bar's + is its one way to add a meal. */
export const EmptyDayState: React.FC<EmptyDayStateProps> = ({
  selectedDate,
  canAdd,
}) => {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  return (
    <EmptyState
      icon="restaurant-outline"
      title={t('emptyDay.title')}
      description={formatFullWeekdayMonthDay(selectedDate)}
      hint={canAdd ? t('emptyDay.addHint') : undefined}
      style={{ paddingBottom: getTabBarBottomPadding(safeBottom) }}
    />
  );
};

EmptyDayState.displayName = 'EmptyDayState';
