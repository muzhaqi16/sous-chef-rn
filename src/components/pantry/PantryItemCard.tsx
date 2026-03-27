import React from 'react';
import { Text, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
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
  location?: string | null;
  variant?: ItemVariant;
  imageUrl?: string | null;
  isOutOfStock?: boolean;
  packageBreakdownText?: string | null;
  remainingNetWeightText?: string | null;
  quantityBreakdownText?: string | null;
  activeBatchCount?: number;
  /** Theme-dependent surface color — ensures re-render on theme change via memo shallow comparison. */
  surfaceColor?: string;
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
const SLIDE_INITIAL = { translateX: 0, opacity: 1 };

const SlideAnimatedWrapper: React.FC<{
  itemId: string;
  onDelete: (id: string) => void;
  children: (handleDelete: () => void) => React.ReactNode;
}> = ({ itemId, onDelete, children }) => {
  // Consolidated into 2 shared values (from 3) to reduce Reanimated bridge overhead per cell
  const slide = useSharedValue(SLIDE_INITIAL);
  const isAnimating = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slide.get().translateX }],
    opacity: slide.get().opacity,
  }));

  // Synchronous reset on FlashList cell recycling — fires during render (before paint)
  useRecyclingState(undefined, [itemId], () => {
    cancelAnimation(slide);
    slide.set(SLIDE_INITIAL);
    isAnimating.set(false);
  });

  // Stable callback for scheduleOnRN — captures onDelete/itemId via closure
  const doDelete = () => {
    onDelete(itemId);
  };

  const handleDelete = () => {
    if (isAnimating.get()) return;
    isAnimating.set(true);

    const config = {
      duration: SLIDE_PRESETS.exitWithFade.duration,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    };

    slide.set(
      withTiming(
        {
          translateX: SCREEN_WIDTH,
          opacity: SLIDE_PRESETS.exitWithFade.opacityTarget,
        },
        config,
        finished => {
          'worklet';
          isAnimating.set(false);
          if (finished) {
            scheduleOnRN(doDelete);
          }
        },
      ),
    );
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
  quantityBreakdownText,
  activeBatchCount,
}) => {
  const { actions, swipeable } = usePantryActions();

  // PERFORMANCE: Single object for all item action callbacks
  const itemActions = {
    onPress: () => actions.onItemPress(id),
    onEdit: actions.onItemEdit ? () => actions.onItemEdit!(id) : undefined,
    onConsume: actions.onItemConsume
      ? () => actions.onItemConsume!(id)
      : undefined,
    onWaste: actions.onItemWaste ? () => actions.onItemWaste!(id) : undefined,
    onRestock: actions.onItemRestock
      ? () => actions.onItemRestock!(id)
      : undefined,
  };

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
            (activeBatchCount && activeBatchCount > 1
              ? `${activeBatchCount} batches`
              : undefined) ||
            location ||
            undefined
          }
          tertiary={
            quantityBreakdownText ||
            packageBreakdownText ||
            remainingNetWeightText ||
            (activeBatchCount && activeBatchCount > 1)
              ? location || undefined
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
      <SlideAnimatedWrapper itemId={id} onDelete={actions.onItemDelete}>
        {renderCard}
      </SlideAnimatedWrapper>
    );
  }

  return renderCard();
};

const styles = StyleSheet.create(theme => ({
  expiration: {
    fontSize: theme.typography.fontSize.sm - 1,
  },
  expirationBold: {
    fontWeight: theme.fonts.weight.medium,
  },
  outOfStock: {
    fontSize: theme.typography.fontSize.sm - 1,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.warning,
  },
}));

// PERFORMANCE: React.memo required — FlashList renderItem (module-scope parent,
// not compiled by React Compiler). Default shallow comparison is sufficient
// because all props are primitives (pre-flattened by PantryContent's computeDisplayMap).
export const PantryItemCard = React.memo(PantryItemCardComponent);

// PantryItemVariant alias for backwards compatibility
export type PantryItemVariant = ItemVariant;
