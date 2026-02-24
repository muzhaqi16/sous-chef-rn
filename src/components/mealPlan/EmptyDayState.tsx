import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { Icon } from '#utils/iconUtils';
import { getTabBarBottomPadding } from '#constants/layout';
import type { MealType } from '#generated';

interface EmptyDayStateProps {
  selectedDate: Date;
  onAddMeal?: (mealType?: MealType) => void;
}

export const EmptyDayState: React.FC<EmptyDayStateProps> = ({
  selectedDate,
  onAddMeal,
}) => {
  const { bottom: safeBottom } = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: getTabBarBottomPadding(safeBottom) }]}>
      <Icon

        name="restaurant-outline"
        size={48}
        color={styles.icon.color}
      />
      <Text style={styles.title}>No meals planned</Text>
      <Text style={styles.subtitle}>
        {format(selectedDate, 'EEEE, MMMM d')}
      </Text>
      {!!onAddMeal && (
        <Pressable
          onPress={() => onAddMeal()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Icon name="add" size={20} color={styles.buttonIcon.color} />
          <Text style={styles.buttonText}>Add a meal</Text>
        </Pressable>
      )}
    </View>
  );
};

EmptyDayState.displayName = 'EmptyDayState';

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
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
  },
  subtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
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
    marginLeft: theme.spacing.xs,
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
  },
}));
