import React from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment } from '@apollo/client/react';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import {
  MealPlanItemCard_ItemFragmentDoc,
  type MealPlanItemCard_ItemFragment,
} from './MealPlanItemCard.generated';

interface MealPlanItemCardProps {
  item: MealPlanItemCard_ItemFragment;
  onToggleCompleted?: (
    id: string,
    isCompleted: boolean,
    hasRecipe: boolean,
  ) => void;
  onPress?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export const MealPlanItemCard: React.FC<MealPlanItemCardProps> = ({
  item: itemSource,
  onToggleCompleted,
  onPress,
  onDelete,
}) => {
  // Subscribe to this entity's MealPlanItemCard_item fields. Re-renders happen
  // only when these specific fields change in the cache.
  const fragmentResult = useFragment({
    fragment: MealPlanItemCard_ItemFragmentDoc,
    fragmentName: 'MealPlanItemCard_item',
    from: itemSource,
  });
  // Cache miss (e.g., entity evicted) — fall back to source data so we never blank out a list item.
  const item = fragmentResult.complete ? fragmentResult.data : itemSource;

  const recipeName = item.recipe?.name ?? item.customMealName ?? 'Unnamed meal';
  const imageUrl = item.recipe?.imageUrl;
  const totalTime = item.recipe?.totalTimeMinutes;
  const usedPantryItems = item.usedPantryItems;
  const hasPantryDeductions =
    item.isCompleted &&
    Array.isArray(usedPantryItems) &&
    usedPantryItems.length > 0;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={() => onPress?.(item.id)}
    >
      {/* Checkbox */}
      {onToggleCompleted ? (
        <Pressable
          onPress={() =>
            onToggleCompleted(item.id, item.isCompleted, !!item.recipe)
          }
          style={styles.checkbox}
          hitSlop={8}
        >
          <Icon
            name={item.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={
              item.isCompleted
                ? styles.checkboxChecked.color
                : styles.checkboxUnchecked.color
            }
          />
        </Pressable>
      ) : (
        <View style={styles.checkbox}>
          <Icon
            name={item.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={
              item.isCompleted
                ? styles.checkboxChecked.color
                : styles.checkboxUnchecked.color
            }
          />
        </View>
      )}

      {/* Image */}
      {!!imageUrl && (
        <CachedImage uri={imageUrl} style={styles.image} displaySize={44} />
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[styles.name, item.isCompleted && styles.nameCompleted]}
          numberOfLines={1}
        >
          {recipeName}
        </Text>
        {!!(
          totalTime != null ||
          item.servings != null ||
          (item.calories != null && item.calories > 0)
        ) && (
          <View style={styles.meta}>
            <Text style={styles.metaText}>
              {[
                totalTime != null && `${totalTime} min`,
                item.servings != null && `${item.servings} servings`,
                item.calories != null &&
                  item.calories > 0 &&
                  `${Math.round(item.calories)} cal`,
              ]
                .filter(Boolean)
                .join(' \u00B7 ')}
            </Text>
          </View>
        )}
        {!!hasPantryDeductions && (
          <View style={styles.pantryBadge}>
            <Icon
              name="leaf-outline"
              size={12}
              color={styles.pantryBadgeText.color}
            />
            <Text style={styles.pantryBadgeText}>Pantry updated</Text>
          </View>
        )}
      </View>

      {/* Delete */}
      {!!onDelete && (
        <Pressable
          onPress={() => onDelete(item.id)}
          style={styles.deleteButton}
          hitSlop={8}
        >
          <Icon
            name="close-circle-outline"
            size={20}
            color={styles.deleteIcon.color}
          />
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
    ...theme.shadows.md,
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
  pantryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  pantryBadgeText: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.success,
    fontWeight: theme.fonts.weight.medium,
  },
  deleteButton: {
    padding: theme.spacing.xs,
  },
  deleteIcon: {
    color: theme.colors.textTertiary,
  },
}));
