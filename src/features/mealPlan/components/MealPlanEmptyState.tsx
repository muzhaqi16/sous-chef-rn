import React from 'react';
import { useTranslation } from '#/i18n';
import { EmptyState } from '#components/atoms/EmptyState';

interface MealPlanEmptyStateProps {
  onCreatePlan: () => void;
  onCreateFromTemplate?: () => void;
}

/**
 * The meal-plan tab's empty state.
 *
 * A thin wrapper over `EmptyState`. It used to reimplement it — its own icon,
 * title, subtitle and two buttons, with its own stylesheet — which is why the
 * spacing drifted from every other empty state in the app.
 */
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
