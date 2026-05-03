import React from 'react';
import { View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
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
  return (
    <View style={styles.container}>
      <Icon name="calendar-outline" size={64} color={styles.icon.color} />
      <Text size="xl" weight="bold" style={styles.title}>
        Plan Your Meals
      </Text>
      <Text size="md" tone="secondary" align="center" style={styles.subtitle}>
        Create a meal plan to organize your weekly or monthly meals, track
        nutrition, and generate shopping lists.
      </Text>
      <Pressable
        onPress={onCreatePlan}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="add" size={20} color={styles.buttonIcon.color} />
        <Text size="md" weight="semibold" style={styles.buttonText}>
          Create Your First Meal Plan
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
            Create from Template
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
