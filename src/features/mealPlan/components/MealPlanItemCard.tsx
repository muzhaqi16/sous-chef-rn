import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment } from '@apollo/client/react';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { RIPPLE } from '#constants/ripple';
import { Text } from '#components/atoms/Text';
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
  const { t } = useTranslation();
  // Subscribe to this entity's MealPlanItemCard_item fields. Re-renders happen
  // only when these specific fields change in the cache.
  const fragmentResult = useFragment({
    fragment: MealPlanItemCard_ItemFragmentDoc,
    fragmentName: 'MealPlanItemCard_item',
    from: itemSource,
  });
  // Cache miss (e.g., entity evicted) — fall back to source data so we never blank out a list item.
  const item = fragmentResult.complete ? fragmentResult.data : itemSource;

  const recipeName =
    item.recipe?.name ?? item.customMealName ?? t('mealPlanItem.unnamedMeal');
  const imageUrl = item.recipe?.imageUrl;
  const totalTime = item.recipe?.totalTimeMinutes;
  const usedPantryItems = item.usedPantryItems;
  const hasPantryDeductions =
    item.isCompleted &&
    Array.isArray(usedPantryItems) &&
    usedPantryItems.length > 0;

  return (
    <AppPressable
      style={styles.card}
      onPress={() => onPress?.(item.id)}
      android_ripple={RIPPLE.SUBTLE}
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
            tone={item.isCompleted ? 'success' : 'border'}
          />
        </Pressable>
      ) : (
        <View style={styles.checkbox}>
          <Icon
            name={item.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            tone={item.isCompleted ? 'success' : 'border'}
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
          size="md"
          weight="medium"
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
            <Text size="sm" tone="secondary">
              {[
                totalTime != null &&
                  t('mealPlanItem.minutes', { count: totalTime }),
                item.servings != null &&
                  t('mealPlanItem.servings', { count: item.servings }),
                item.calories != null &&
                  item.calories > 0 &&
                  t('mealPlanItem.calories', {
                    count: Math.round(item.calories),
                  }),
              ]
                .filter(Boolean)
                .join(' \u00B7 ')}
            </Text>
          </View>
        )}
        {!!hasPantryDeductions && (
          <View style={styles.pantryBadge}>
            <Icon name="leaf-outline" size={12} tone="success" />
            <Text size="xs" weight="medium" style={styles.pantryBadgeText}>
              {t('mealPlanItem.pantryUpdated')}
            </Text>
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
          <Icon name="close-circle-outline" size={20} tone="textTertiary" />
        </Pressable>
      )}
    </AppPressable>
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
  pantryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  pantryBadgeText: {
    color: theme.colors.success,
  },
  deleteButton: {
    padding: theme.spacing.xs,
  },
}));
