import React from 'react';
import { useTranslation } from '#/i18n';
import { EmptyState } from '#components/atoms/EmptyState';

interface MealPlanEmptyStateProps {
  onCreatePlan: () => void;
  onCreateFromTemplate?: () => void;
}

export const MealPlanEmptyState: React.FC<MealPlanEmptyStateProps> = ({
  onCreatePlan,
  onCreateFromTemplate,
}) => {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon="calendar-outline"
      iconSize={64}
      title={t('mealPlanEmpty.title')}
      description={t('mealPlanEmpty.subtitle')}
      action={{
        label: t('mealPlanEmpty.createFirst'),
        onPress: onCreatePlan,
        icon: 'add',
      }}
      secondaryAction={
        onCreateFromTemplate
          ? {
              label: t('mealPlanEmpty.createFromTemplate'),
              onPress: onCreateFromTemplate,
              icon: 'document-text-outline',
            }
          : undefined
      }
    />
  );
};
