import { deleteAction } from '#components/organisms/SwipeableItem/commonActions';
import { RowCard } from '#components/atoms/RowCard';
import React from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { Icon } from '#components/atoms/Icon';
import { RowThumbnail } from '#components/atoms/RowThumbnail';
import { Text } from '#components/atoms/Text';
import { SwipeableItem } from '#components/organisms/SwipeableItem/SwipeableItem';
import { ListItem } from '#components/molecules/ListItem';
import type { SwipeableRef } from '#components/organisms/SwipeableItem/types';
import { MealPlanItemCard_ItemFragmentDoc } from './MealPlanItemCard.generated';
import { hitSlop } from '#/theme/foundations/sizes';
import { mealPlanTestIDs } from '#features/mealPlan/testIDs';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';

interface MealPlanItemCardProps {
  item: FragmentType<typeof MealPlanItemCard_ItemFragmentDoc>;
  /** The meal it is, such as "Dinner", where no section heading says so. */
  mealTypeLabel?: string;
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
  mealTypeLabel,
  onToggleCompleted,
  onPress,
  onDelete,
  onSwipeableWillOpen,
  onSwipeableClose,
}) => {
  const { t } = useTranslation();
  const fragmentResult = useFragment({
    fragment: MealPlanItemCard_ItemFragmentDoc,
    fragmentName: 'MealPlanItemCard_item',
    from: itemSource,
  });
  if (!fragmentResult.complete) return null;
  const item = fragmentResult.data;

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
      hitSlop={hitSlop.md}
      testID={mealPlanTestIDs.itemCompleteToggle(item.id)}
      accessibilityLabel={
        item.isCompleted ? t('a11y.markIncomplete') : t('a11y.markComplete')
      }
    >
      <Icon
        name={item.isCompleted ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        tone={item.isCompleted ? 'success' : 'border'}
      />
    </Pressable>
  ) : item.isCompleted ? (
    // Read-only: a done meal says so; an empty circle would read as a control.
    <Icon name="checkmark-circle" size={24} tone="success" />
  ) : undefined;

  const leftElement = <RowThumbnail uri={imageUrl} />;

  const metaText = [
    mealTypeLabel,
    // A recipe with no known time stores 0, which is not "0 min".
    totalTime != null && totalTime > 0 && t('labels.min', { count: totalTime }),
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
          <Text role="caption" tone="secondary">
            {metaText}
          </Text>
        )}
        {!!hasPantryDeductions && (
          <View style={styles.pantryBadge}>
            <Icon name="leaf-outline" size={12} tone="success" />
            <Text role="label" style={styles.pantryBadgeText}>
              {t('mealPlanItem.pantryUpdated')}
            </Text>
          </View>
        )}
      </>
    ) : undefined;

  const accessibilityLabel = accessibilityLabelOf(
    recipeName,
    item.isCompleted && t('labels.done'),
    metaText,
    hasPantryDeductions && t('mealPlanItem.pantryUpdated'),
  );
  const handlePress = onPress ? () => onPress(item.id) : undefined;

  // A read-only row mounts no swipe gesture, so it sits in any scroll host.
  if (!onToggleCompleted && !onDelete) {
    return (
      <RowCard>
        <ListItem
          checkboxElement={checkboxElement}
          leftElement={leftElement}
          title={recipeName}
          titleNumberOfLines={1}
          subtitle={subtitle}
          isPurchased={item.isCompleted}
          onPress={handlePress}
          accessibilityLabel={accessibilityLabel}
        />
      </RowCard>
    );
  }

  return (
    <RowCard>
      <SwipeableItem
        itemId={item.id}
        accessibilityLabel={accessibilityLabel}
        onPress={handlePress}
        rightActions={
          onDelete
            ? [{ ...deleteAction(() => onDelete(item.id)), removesRow: true }]
            : undefined
        }
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
        />
      </SwipeableItem>
    </RowCard>
  );
};

MealPlanItemCard.displayName = 'MealPlanItemCard';

const styles = StyleSheet.create(theme => ({
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
