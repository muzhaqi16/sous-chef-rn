import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import type { MealPlanItemFragment } from '#generated';

interface MealPlanItemCardProps {
  item: MealPlanItemFragment;
  onToggleCompleted: (id: string, isCompleted: boolean) => void;
  onPress?: (item: MealPlanItemFragment) => void;
  onDelete?: (id: string) => void;
}

export const MealPlanItemCard: React.FC<MealPlanItemCardProps> = ({
  item,
  onToggleCompleted,
  onPress,
  onDelete,
}) => {
  const recipeName = item.recipe?.name ?? item.customMealName ?? 'Unnamed meal';
  const imageUrl = item.recipe?.imageUrl;
  const totalTime = item.recipe?.totalTimeMinutes;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress?.(item)}
    >
      {/* Checkbox */}
      <Pressable
        onPress={() => onToggleCompleted(item.id, item.isCompleted)}
        style={styles.checkbox}
        hitSlop={8}
      >
        <Icon

          name={item.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={item.isCompleted ? styles.checkboxChecked.color : styles.checkboxUnchecked.color}
        />
      </Pressable>

      {/* Image */}
      {imageUrl && (
        <CachedImage uri={imageUrl} style={styles.image} />
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[styles.name, item.isCompleted && styles.nameCompleted]}
          numberOfLines={1}
        >
          {recipeName}
        </Text>
        <View style={styles.meta}>
          {totalTime != null && (
            <Text style={styles.metaText}>
              {totalTime} min
            </Text>
          )}
          {item.servings != null && (
            <Text style={styles.metaText}>
              {totalTime != null ? ' \u00B7 ' : ''}
              {item.servings} servings
            </Text>
          )}
        </View>
      </View>

      {/* Delete */}
      {onDelete && (
        <Pressable onPress={() => onDelete(item.id)} style={styles.deleteButton} hitSlop={8}>
          <Icon name="close-circle-outline" size={20} color={styles.deleteIcon.color} />
        </Pressable>
      )}
    </Pressable>
  );
};

MealPlanItemCard.displayName = 'MealPlanItemCard';

const styles = StyleSheet.create(theme => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
  checkbox: {
    marginRight: theme.spacing.sm,
  },
  checkboxChecked: {
    color: theme.colors.success,
  },
  checkboxUnchecked: {
    color: theme.colors.border,
  },
  image: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    marginRight: theme.spacing.sm,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  nameCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textTertiary,
  },
  meta: {
    flexDirection: 'row',
    marginTop: 2,
  },
  metaText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
  },
  deleteButton: {
    padding: theme.spacing.xs,
  },
  deleteIcon: {
    color: theme.colors.textTertiary,
  },
}));
