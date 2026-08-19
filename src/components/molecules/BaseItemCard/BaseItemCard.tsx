import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { SwipeableItem } from '#/components/molecules/SwipeableItem/SwipeableItem';
import { HapticService } from '#services/haptic/HapticService';
import { RIPPLE } from '#constants/ripple';
import type { BaseItemCardProps, CardVariant } from './types';

/**
 * Base item card component with swipeable actions
 * Provides a flexible slot-based layout for different item types
 *
 * When to use which card:
 * - Use `BaseItemCard` when you need full slot-based flexibility — custom
 *   left/right slots, counters, purchase toggles, per-slot variants. The
 *   caller owns any exit animation.
 * - Use `ItemCard` (`#components/organisms/ItemCard`) for the common
 *   title/subtitle/badge list row that needs the standard slide-off-screen
 *   exit animation on delete/consume/waste handled automatically.
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
/**
 * The card surface, owning the `variant` → background/border mapping and the
 * `useVariants` call that selects it.
 *
 * Extracted so `BaseItemCard` itself keeps compiling: Unistyles' variant
 * transform makes the React Compiler bail out of whatever function contains
 * the call, and `BaseItemCard` is the row component behind every list in the
 * app. `node scripts/check-compiler-bailouts.mjs --list` names the bailing
 * function, so the leaf's own (harmless) bailout stays distinguishable from a
 * regression here.
 */
const CardSurface: React.FC<{
  variant: CardVariant;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}> = ({ variant, containerStyle, testID, children }) => {
  styles.useVariants({ variant });
  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      {children}
    </View>
  );
};

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
  itemId,
  testID,
}) => {
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
    <CardSurface
      variant={variant}
      containerStyle={containerStyle}
      testID={testID}
    >
      {slotChildren}
    </CardSurface>
  );

  // Check if we have any swipe actions
  const hasSwipeActions =
    onEdit || onDelete || onConsume || onWaste || onRestock || onTogglePurchase;

  if (hasSwipeActions) {
    return (
      <View style={styles.swipeableWrapper}>
        <SwipeableItem
          itemId={itemId}
          // Without this, `RightActions` renders its buttons with
          // `testID={undefined}` — every swipe action in the app was
          // unreachable from a test. The row's own testID is the natural
          // prefix, so a pantry row gives `pantry-item-<id>-delete` / `-edit`.
          testIDPrefix={testID}
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

  if (onPress) {
    const handlePress = () => {
      HapticService.selection();
      onPress();
    };
    return (
      <View style={styles.swipeableWrapper}>
        <AppPressable
          onPress={handlePress}
          android_ripple={RIPPLE.SUBTLE}
          style={[]}
        >
          {cardContent}
        </AppPressable>
      </View>
    );
  }

  return <View style={styles.swipeableWrapper}>{cardContent}</View>;
};

const styles = StyleSheet.create(theme => ({
  swipeableWrapper: {
    marginBottom: theme.spacing['2.5'],
    // Match the search bar inset so rows line up with it and the floating
    // tab bar instead of sitting narrower.
    marginHorizontal: theme.spacing['3'],
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.sizes.itemCard.compact.height,
    padding: theme.spacing['3'],
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    // Soft floating elevation instead of a hard outline. Status variants below
    // keep a colored border to stay distinguishable; the default row relies on
    // the shadow alone (transparent border preserves consistent sizing).
    ...theme.shadows.card,
    backgroundColor: theme.colors.surface,
    borderColor: 'transparent',
    variants: {
      variant: {
        normal: {
          backgroundColor: theme.colors.surface,
          borderColor: 'transparent',
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
