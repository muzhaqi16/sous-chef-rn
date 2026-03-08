import React from 'react';
import { Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useRecyclingState } from '@shopify/flash-list';
import { StyleSheet } from 'react-native-unistyles';
import { BaseItemCard } from '../molecules/BaseItemCard/BaseItemCard';
import { CardLeftSlot } from '../molecules/BaseItemCard/CardLeftSlot';
import { CardContent } from '../molecules/BaseItemCard/CardContent';
import { CardRightSlot } from '../molecules/BaseItemCard/CardRightSlot';
import type { CardVariant } from '../molecules/BaseItemCard/types';
import { SLIDE_PRESETS } from '#/constants/animations';
import { usePantryActions } from './PantryActionsContext';

// Module-level constant — only used for slide animation distance, no need for reactive updates
const SCREEN_WIDTH = Dimensions.get('window').width;

export type ItemVariant = 'normal' | 'warning' | 'expired';

export type ExpirationVariant = 'normal' | 'warning' | 'critical' | 'expired';

interface PantryItemCardProps {
  id: string;
  name: string;
  expirationText?: string | null;
  expirationVariant?: ExpirationVariant;
  expirationColor?: string;
  quantity: string;
  location: string;
  variant?: ItemVariant;
  imageUrl?: string | null;
  isOutOfStock?: boolean;
  packageBreakdownText?: string | null;
  remainingNetWeightText?: string | null;
  quantityBreakdownText?: string | null;
}

/**
 * Expiration text — pure presentational, color precomputed by parent list.
 * Eliminates per-item useUnistyles subscription.
 * Memoized to prevent re-renders from context-triggered parent re-renders.
 */
const ExpirationText = React.memo<{
  text: string;
  color: string;
  bold: boolean;
}>(({ text, color, bold }) => (
  <Text
    style={[styles.expiration, { color }, bold && styles.expirationBold]}
    numberOfLines={1}
  >
    {text}
  </Text>
));

/**
 * Lightweight slide-right + fade animation wrapper for delete.
 * Always renders <Animated.View> so the React tree structure never changes,
 * preventing image flicker caused by View → Animated.View swaps.
 */
const SlideAnimatedWrapper: React.FC<{
  itemId: string;
  children: (handleDelete: () => void) => React.ReactNode;
}> = ({ itemId, children }) => {
  const { actions } = usePantryActions();

  const translateX = useSharedValue(0);
  const slideOpacity = useSharedValue(1);
  const isAnimating = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.get() }],
    opacity: slideOpacity.get() }));

  // Synchronous reset on FlashList cell recycling — fires during render (before paint)
  useRecyclingState(undefined, [itemId], () => {
    cancelAnimation(translateX);
    cancelAnimation(slideOpacity);
    translateX.set(0);
    slideOpacity.set(1);
    isAnimating.set(false);
  });

  // Stable callback for scheduleOnRN — captures actions/itemId via closure
  const doDelete = () => {
    actions.onItemDelete?.(itemId);
  };

  const handleDelete = () => {
    if (isAnimating.get()) return;
    isAnimating.set(true);

    const config = {
      duration: SLIDE_PRESETS.exitWithFade.duration,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1) };

    slideOpacity.set(withTiming(
      SLIDE_PRESETS.exitWithFade.opacityTarget,
      config,
    ));
    translateX.set(withTiming(SCREEN_WIDTH, config, finished => {
      'worklet';
      isAnimating.set(false);
      if (finished) {
        scheduleOnRN(doDelete);
      }
    }));
  };

  return (
    <Animated.View style={animatedStyle}>
      {children(handleDelete)}
    </Animated.View>
  );
};

/**
 * Pantry item card using BaseItemCard composition
 * Displays item with emoji/image, name, expiration status, quantity, and location
 * Slide animation handled by SlideAnimatedWrapper (always renders Animated.View)
 */
const PantryItemCardComponent: React.FC<PantryItemCardProps> = ({
  id,
  name,
  expirationText,
  expirationVariant,
  expirationColor,
  quantity,
  location,
  variant = 'normal',
  imageUrl,
  isOutOfStock,
  packageBreakdownText,
  remainingNetWeightText,
  quantityBreakdownText }) => {
  const { actions, swipeable } = usePantryActions();

  // PERFORMANCE: Single object for all item action callbacks
  const itemActions = ({
      onPress: () => actions.onItemPress(id),
      onEdit: actions.onItemEdit ? () => actions.onItemEdit!(id) : undefined,
      onConsume: actions.onItemConsume
        ? () => actions.onItemConsume!(id)
        : undefined,
      onWaste: actions.onItemWaste ? () => actions.onItemWaste!(id) : undefined,
      onRestock: actions.onItemRestock
        ? () => actions.onItemRestock!(id)
        : undefined });

  // Map ItemVariant to CardVariant
  const cardVariant: CardVariant = variant;

  // Only show image if available, no placeholder
  const leftElement = imageUrl ? (
    <CardLeftSlot type="image" imageUrl={imageUrl} variant={cardVariant} />
  ) : undefined;

  const expirationBold = !!expirationVariant && expirationVariant !== 'normal';

  const getSubtitle = () => {
    if (isOutOfStock) {
      return <Text style={styles.outOfStock}>Out of stock</Text>;
    }
    if (expirationText && expirationColor) {
      return (
        <ExpirationText
          text={expirationText}
          color={expirationColor}
          bold={expirationBold}
        />
      );
    }
    return undefined;
  };

  // Shared card content — used with or without slide animation wrapper
  const renderCard = (onDelete?: () => void) => (
    <BaseItemCard
      itemId={id}
      variant={cardVariant}
      onPress={itemActions.onPress}
      onEdit={itemActions.onEdit}
      onDelete={onDelete}
      onConsume={itemActions.onConsume}
      onWaste={itemActions.onWaste}
      onRestock={itemActions.onRestock}
      onSwipeableWillOpen={swipeable.onSwipeableWillOpen}
      leftThreshold={80}
      rightThreshold={80}
      testID={`pantry-item-${id}`}
      leftElement={leftElement}
      rightElement={
        <CardRightSlot
          type="meta"
          primary={quantity}
          secondary={
            quantityBreakdownText ||
            packageBreakdownText ||
            remainingNetWeightText ||
            location
          }
          tertiary={
            quantityBreakdownText ||
            packageBreakdownText ||
            remainingNetWeightText
              ? location
              : undefined
          }
        />
      }
    >
      <CardContent title={name} subtitle={getSubtitle()} />
    </BaseItemCard>
  );

  if (actions.onItemDelete) {
    return (
      <SlideAnimatedWrapper itemId={id}>{renderCard}</SlideAnimatedWrapper>
    );
  }

  return renderCard();
};

const styles = StyleSheet.create(theme => ({
  expiration: {
    fontSize: theme.typography.fontSize.sm - 1 },
  expirationBold: {
    fontWeight: theme.fonts.weight.medium },
  outOfStock: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.warning } }));

// PERFORMANCE: Custom comparator only checks data primitives — action callbacks come
// from context and don't appear in props, so every prop is a stable primitive/string.
export const PantryItemCard = React.memo(
  PantryItemCardComponent,
  (prev, next) =>
    prev.id === next.id &&
    prev.name === next.name &&
    prev.expirationText === next.expirationText &&
    prev.expirationVariant === next.expirationVariant &&
    prev.expirationColor === next.expirationColor &&
    prev.quantity === next.quantity &&
    prev.location === next.location &&
    prev.variant === next.variant &&
    prev.imageUrl === next.imageUrl &&
    prev.isOutOfStock === next.isOutOfStock &&
    prev.packageBreakdownText === next.packageBreakdownText &&
    prev.remainingNetWeightText === next.remainingNetWeightText &&
    prev.quantityBreakdownText === next.quantityBreakdownText,
);

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
