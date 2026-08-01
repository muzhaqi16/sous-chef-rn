import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment } from '@apollo/client/react';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';
import { SwipeableItem } from '#components/molecules/SwipeableItem/SwipeableItem';
import { ListItem } from '#components/molecules/ListItem';
import { type SwipeableRef } from '#components/molecules/SwipeableItem/types';
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
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  onSwipeableClose?: () => void;
}

export const MealPlanItemCard: React.FC<MealPlanItemCardProps> = ({
  item: itemSource,
  onToggleCompleted,
  onPress,
  onDelete,
  onSwipeableWillOpen,
  onSwipeableClose,
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

  // Completion toggle. Uses RNGH's Pressable (like AnimatedCheckbox) because the
  // row's Swipeable is an RNGH gesture: RNGH's native button captures the tap so
  // it toggles completion without also firing the row's onPress. An RN Pressable
  // here lives in a separate gesture system and the tap fires both.
  const checkboxElement = onToggleCompleted ? (
    <Pressable
      onPress={() =>
        onToggleCompleted(item.id, item.isCompleted, !!item.recipe)
      }
      hitSlop={8}
    >
      <Icon
        name={item.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        tone={item.isCompleted ? 'success' : 'border'}
      />
    </Pressable>
  ) : (
    <Icon
      name={item.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
      size={24}
      tone={item.isCompleted ? 'success' : 'border'}
    />
  );

  const leftElement = imageUrl ? (
    <CachedImage uri={imageUrl} style={styles.image} displaySize={48} />
  ) : undefined;

  const metaText = [
    totalTime != null && t('mealPlanItem.minutes', { count: totalTime }),
    item.servings != null &&
      t('mealPlanItem.servings', { count: item.servings }),
    item.calories != null &&
      item.calories > 0 &&
      t('mealPlanItem.calories', { count: Math.round(item.calories) }),
  ]
    .filter(Boolean)
    .join(' · ');

  const subtitle =
    metaText || hasPantryDeductions ? (
      <>
        {!!metaText && (
          <Text size="sm" tone="secondary">
            {metaText}
          </Text>
        )}
        {!!hasPantryDeductions && (
          <View style={styles.pantryBadge}>
            <Icon name="leaf-outline" size={12} tone="success" />
            <Text size="xs" weight="medium" style={styles.pantryBadgeText}>
              {t('mealPlanItem.pantryUpdated')}
            </Text>
          </View>
        )}
      </>
    ) : undefined;

  return (
    <View style={styles.rowWrapper}>
      <SwipeableItem
        itemId={item.id}
        swipeMode="shopping"
        onPress={onPress ? () => onPress(item.id) : undefined}
        onDelete={onDelete ? () => onDelete(item.id) : undefined}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
      >
        <ListItem
          checkboxElement={checkboxElement}
          leftElement={leftElement}
          title={recipeName}
          titleNumberOfLines={1}
          subtitle={subtitle}
          isPurchased={item.isCompleted}
          rightIcon={null}
        />
      </SwipeableItem>
    </View>
  );
};

MealPlanItemCard.displayName = 'MealPlanItemCard';

const styles = StyleSheet.create(theme => ({
  rowWrapper: {
    marginBottom: theme.spacing['2.5'],
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
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
}));
