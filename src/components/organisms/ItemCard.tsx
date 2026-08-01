import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { SwipeableItem } from '#components/molecules/SwipeableItem/SwipeableItem';
import type { SwipeableRef } from '#components/molecules/SwipeableItem/types';
import { ListItem } from '../molecules/ListItem';
import { StyleSheet } from 'react-native-unistyles';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import { SLIDE_PRESETS } from '#/constants/animations';

/**
 * Themed list-row card with a built-in full-width slide-out animation on
 * delete/consume/waste, composed from {@link ListItem} + {@link SwipeableItem}.
 *
 * When to use which card:
 * - Use `ItemCard` for the common title/subtitle/badge list row where you want
 *   the standard slide-off-screen exit animation handled for you.
 * - Use {@link BaseItemCard} when you need full slot-based flexibility
 *   (custom left/right slots, counters, purchase toggles) and will own the
 *   exit animation (if any) yourself.
 */
interface ItemCardProps {
  id: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onConsume?: () => void;
  onWaste?: () => void;
  onRestock?: () => void;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
  testID?: string;
}

/**
 * Interactive variant — owns the swipe gestures and the slide-out exit
 * animation. Split out from {@link ItemCard} so it (and the per-row reanimated
 * shared values + `Animated.View` + `SwipeableItem` it sets up) is mounted
 * ONLY for rows that actually have swipe actions. Read-only lists (recipe
 * discovery, search results) render the lightweight path below instead, which
 * matters at scale: a full screen of ~17 rows would otherwise spin up ~17
 * unused animated styles + gesture handlers on first paint.
 */
const SwipeableItemCard: React.FC<ItemCardProps> = ({
  id,
  title,
  subtitle,
  onPress,
  onEdit,
  onDelete,
  onConsume,
  onWaste,
  onRestock,
  onSwipeableWillOpen,
  badge,
  rightElement,
  leftElement,
  testID,
}) => {
  const { width: screenWidth } = useWindowDimensions();

  // Slide animation for delete/consume/waste actions
  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId: id,
    slideDistance: screenWidth,
    duration: SLIDE_PRESETS.exitWithFade.duration,
    withOpacity: SLIDE_PRESETS.exitWithFade.withOpacity,
    opacityTarget: SLIDE_PRESETS.exitWithFade.opacityTarget,
  });

  const handleDelete = () => {
    if (onDelete) triggerSlide(1, onDelete);
  };
  const handleConsume = () => {
    if (onConsume) triggerSlide(1, onConsume);
  };
  const handleWaste = () => {
    if (onWaste) triggerSlide(1, onWaste);
  };

  return (
    <Animated.View
      style={[styles.container, animatedSlideStyle]}
      testID={testID}
    >
      <SwipeableItem
        onPress={onPress}
        onEdit={onEdit}
        onDelete={onDelete ? handleDelete : undefined}
        onConsume={onConsume ? handleConsume : undefined}
        onWaste={onWaste ? handleWaste : undefined}
        onRestock={onRestock}
        onSwipeableWillOpen={onSwipeableWillOpen}
        testIDPrefix={testID}
      >
        <ListItem
          title={title}
          subtitle={subtitle}
          badge={badge}
          rightElement={rightElement}
          leftElement={leftElement}
        />
      </SwipeableItem>
    </Animated.View>
  );
};

const ItemCardComponent: React.FC<ItemCardProps> = props => {
  const {
    title,
    subtitle,
    onPress,
    onEdit,
    onDelete,
    onConsume,
    onWaste,
    onRestock,
    badge,
    rightElement,
    leftElement,
    testID,
  } = props;

  const hasSwipeActions = !!(
    onEdit ||
    onDelete ||
    onConsume ||
    onWaste ||
    onRestock
  );

  // Lightweight path: a row with no swipe actions can never slide, so skip the
  // per-row reanimated machinery (3 shared values + an animated style worklet)
  // and the `Animated.View` wrapper entirely — a plain styled row is enough.
  if (!hasSwipeActions) {
    return (
      <View style={styles.container} testID={testID}>
        <ListItem
          title={title}
          subtitle={subtitle}
          onPress={onPress}
          badge={badge}
          rightElement={rightElement}
          leftElement={leftElement}
        />
      </View>
    );
  }

  return <SwipeableItemCard {...props} />;
};

// React Compiler memoizes JSX at the parent call site, so React.memo is
// redundant on non-FlashList components. Per CLAUDE.md / project memory.
export const ItemCard = ItemCardComponent;

const styles = StyleSheet.create(theme => ({
  container: {
    opacity: 1, // Prevent transparency inheritance
    marginHorizontal: theme.spacing['3'],
    marginVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
    borderCurve: 'continuous',
    boxSizing: 'border-box',
    ...theme.shadows.card,
  },
}));
