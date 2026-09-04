import React from 'react';
import { useTranslation } from '#/i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '#components/molecules/EmptyState';
import { getTabBarBottomPadding } from '#constants/layout';
import { type MealType } from '#/graphql/generated/schemaTypes';
import { formatFullWeekdayMonthDay } from '#/utils/formatters/date';

interface EmptyDayStateProps {
  selectedDate: Date;
  onAddMeal?: (mealType?: MealType) => void;
}

export const EmptyDayState: React.FC<EmptyDayStateProps> = ({
  selectedDate,
  onAddMeal,
}) => {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  return (
    <EmptyState
      icon="restaurant-outline"
      title={t('emptyDay.title')}
      description={formatFullWeekdayMonthDay(selectedDate)}
      action={
        onAddMeal
          ? {
              label: t('labels.addAMeal'),
              onPress: () => onAddMeal(),
              icon: 'add',
            }
          : undefined
      }
      style={{ paddingBottom: getTabBarBottomPadding(safeBottom) }}
    />
  );
};

EmptyDayState.displayName = 'EmptyDayState';
