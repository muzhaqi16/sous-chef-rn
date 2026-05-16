import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
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
      <Icon name="calendar-outline" size={64} color={styles.icon.color} />
      <Text size="xl" weight="bold" style={styles.title}>
        {t('mealPlanEmpty.title')}
      </Text>
      <Text size="md" tone="secondary" align="center" style={styles.subtitle}>
        {t('mealPlanEmpty.subtitle')}
      </Text>
      <Pressable
        onPress={onCreatePlan}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="add" size={20} color={styles.buttonIcon.color} />
        <Text size="md" weight="semibold" style={styles.buttonText}>
          {t('mealPlanEmpty.createFirst')}
        </Text>
      </Pressable>
      {!!onCreateFromTemplate && (
        <Pressable
          onPress={onCreateFromTemplate}
          style={({ pressed }) => [
            styles.templateButton,
            pressed && styles.pressed,
          ]}
        >
          <Icon
            name="document-text-outline"
            size={20}
            color={styles.templateButtonIcon.color}
          />
          <Text
            size="md"
            weight="semibold"
            tone="accent"
            style={styles.templateButtonText}
          >
            {t('mealPlanEmpty.createFromTemplate')}
          </Text>
        </Pressable>
      )}
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
  icon: {
    color: theme.colors.textTertiary,
  },
  title: {
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  buttonIcon: {
    color: theme.colors.white,
  },
  buttonText: {
    marginLeft: theme.spacing.sm,
    color: theme.colors.white,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  templateButtonIcon: {
    color: theme.colors.primary,
  },
  templateButtonText: {
    marginLeft: theme.spacing.sm,
  },
}));
