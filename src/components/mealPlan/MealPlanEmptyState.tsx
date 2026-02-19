import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';

interface MealPlanEmptyStateProps {
  onCreatePlan: () => void;
}

export const MealPlanEmptyState: React.FC<MealPlanEmptyStateProps> = React.memo(({
  onCreatePlan,
}) => {
  return (
    <View style={styles.container}>
      <Icon
        library="Ionicons"
        name="calendar-outline"
        size={64}
        color={styles.icon.color}
      />
      <Text style={styles.title}>Plan Your Meals</Text>
      <Text style={styles.subtitle}>
        Create a meal plan to organize your weekly or monthly meals, track nutrition, and generate shopping lists.
      </Text>
      <Pressable
        onPress={onCreatePlan}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon library="Ionicons" name="add" size={20} color={styles.buttonIcon.color} />
        <Text style={styles.buttonText}>Create Your First Meal Plan</Text>
      </Pressable>
    </View>
  );
});

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
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
  },
}));
