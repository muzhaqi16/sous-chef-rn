import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SwipeableItem } from '#/components/molecules/SwipeableItem';
import type { BaseItemCardProps } from './types';

// Re-export types and slot components
export type {
  BaseItemCardProps,
  CardVariant,
  CardLeftSlotProps,
  CardContentProps,
  CardRightSlotProps,
} from './types';
export { CardLeftSlot } from './CardLeftSlot';
export { CardContent } from './CardContent';
export { CardRightSlot } from './CardRightSlot';

/**
 * Base item card component with swipeable actions
 * Provides a flexible slot-based layout for different item types
 *
 * @example
 * // Pantry item
 * <BaseItemCard
 *   variant="warning"
 *   onPress={handlePress}
 *   onConsume={handleConsume}
 *   onWaste={handleWaste}
 *   onRestock={handleRestock}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * >
 *   <CardLeftSlot type="emoji" emoji="🥬" variant="warning" />
 *   <CardContent title="Spinach" subtitle="Expires in 2 days" />
 *   <CardRightSlot type="meta" primary="500g" secondary="Fridge" />
 * </BaseItemCard>
 *
 * // Shopping list item
 * <BaseItemCard
 *   variant={isPurchased ? 'dimmed' : 'normal'}
 *   isPurchased={isPurchased}
 *   onTogglePurchase={handleToggle}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 * >
 *   <CardLeftSlot type="image" imageUrl={imageUrl} dimmed={isPurchased} />
 *   <CardContent title="Milk" subtitle="Dairy" isPurchased={isPurchased} />
 *   <CardRightSlot type="counter" quantity={2} unit="L" onIncrement={...} onDecrement={...} />
 * </BaseItemCard>
 */
export const BaseItemCard: React.FC<BaseItemCardProps> = ({
  leftElement,
  children,
  rightElement,
  variant = 'normal',
  containerStyle,
  onPress,
  onEdit,
  onDelete,
  onConsume,
  onWaste,
  onRestock,
  onTogglePurchase,
  onSwipeableWillOpen,
  onSwipeableClose,
  isPurchased,
  leftThreshold = 80,
  rightThreshold = 80,
  testID,
}) => {
  // Select variant for styling
  styles.useVariants({ variant });

  // Build children array from slot props with keys to prevent React warnings
  const slotChildren: React.ReactNode[] = [];
  if (leftElement)
    slotChildren.push(
      <React.Fragment key="left">{leftElement}</React.Fragment>,
    );
  if (children)
    slotChildren.push(
      <React.Fragment key="content">{children}</React.Fragment>,
    );
  if (rightElement)
    slotChildren.push(
      <React.Fragment key="right">{rightElement}</React.Fragment>,
    );

  const cardContent = (
    <View
      style={[styles.container, containerStyle]}
      testID={testID}
    >
      {slotChildren}
    </View>
  );

  // Check if we have any swipe actions
  const hasSwipeActions =
    onEdit || onDelete || onConsume || onWaste || onRestock || onTogglePurchase;

  if (hasSwipeActions) {
    return (
      <View style={styles.swipeableWrapper}>
        <SwipeableItem
          onPress={onPress}
          onEdit={onEdit}
          onDelete={onDelete}
          onConsume={onConsume}
          onWaste={onWaste}
          onRestock={onRestock}
          onTogglePurchase={onTogglePurchase}
          isPurchased={isPurchased}
          onSwipeableWillOpen={onSwipeableWillOpen}
          onSwipeableClose={onSwipeableClose}
          leftThreshold={leftThreshold}
          rightThreshold={rightThreshold}
        >
          {cardContent}
        </SwipeableItem>
      </View>
    );
  }

  // No swipe actions - render as pressable card
  return (
    <View style={styles.swipeableWrapper}>
      <SwipeableItem onPress={onPress}>{cardContent}</SwipeableItem>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  swipeableWrapper: {
    marginBottom: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    shadowColor: theme.colors.backgroundSecondary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
    // Default styles (applied when no variant matches)
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderLight,
    variants: {
      variant: {
        normal: {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.borderLight,
        },
        warning: {
          backgroundColor: theme.colors.expiration.warningBg,
          borderColor: theme.colors.expiration.warningBorder,
        },
        expired: {
          backgroundColor: theme.colors.expiration.expiredBg,
          borderColor: theme.colors.expiration.expiredBorder,
        },
        success: {
          backgroundColor: theme.colors.alertBanner.success.bg,
          borderColor: theme.colors.alertBanner.success.border,
        },
        dimmed: {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.borderLight,
          opacity: 0.8,
        },
      },
    },
  },
}));
