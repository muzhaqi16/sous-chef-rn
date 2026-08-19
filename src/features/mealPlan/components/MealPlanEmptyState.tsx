import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Button } from '#components/base/Button';
import { Text } from '#components/atoms/Text';

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
    <View style={styles.container}>
      <Icon name="calendar-outline" size={64} tone="textTertiary" />
      <Text size="xl" weight="bold" style={styles.title}>
        {t('mealPlanEmpty.title')}
      </Text>
      <Text size="md" tone="secondary" align="center" style={styles.subtitle}>
        {t('mealPlanEmpty.subtitle')}
      </Text>
      <View style={styles.actions}>
        <Button
          variant="primary"
          icon="add"
          title={t('mealPlanEmpty.createFirst')}
          onPress={onCreatePlan}
          style={styles.button}
        />
        {!!onCreateFromTemplate && (
          <Button
            variant="outline"
            icon="document-text-outline"
            title={t('mealPlanEmpty.createFromTemplate')}
            onPress={onCreateFromTemplate}
            style={styles.button}
          />
        )}
      </View>
    </View>
  );
};

MealPlanEmptyState.displayName = 'MealPlanEmptyState';

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  title: {
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  actions: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  button: {
    paddingHorizontal: theme.spacing.xl,
  },
}));
