import React from 'react';
import { useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { SwipeableItem } from '#components/organisms/SwipeableItem/SwipeableItem';
import type {
  SwipeAction,
  SwipeableRef,
} from '#components/organisms/SwipeableItem/types';
import { ListItem } from '../molecules/ListItem';
import type { BadgeContent } from '#components/atoms/Badge';
import { RowCard } from '#components/atoms/RowCard';
import { ThemeEpochSentinel } from '#components/atoms/ThemeEpochSentinel';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import { SLIDE_PRESETS } from '#/constants/animations';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';

/**
 * The standard title/subtitle/badge row, with the slide-off-screen exit handled
 * for you. {@link BaseItemCard} is the slot-flexible one whose caller owns any
 * exit animation.
 */
interface ItemCardProps {
  id: string;
  title: string;
  subtitle: string | React.ReactNode;
  onPress: () => void;
  /** Revealed by swiping right. Actions flagged `removesRow` slide the row out. */
  leftActions?: SwipeAction[];
  /** Revealed by swiping left. Actions flagged `removesRow` slide the row out. */
  rightActions?: SwipeAction[];
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  badge?: BadgeContent;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
  /** The row's spoken label, when `rightElement` shows text: title, subtitle and badge otherwise. */
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * The swipe-and-slide variant, split out so its per-row shared values,
 * `Animated.View` and `SwipeableItem` mount ONLY for rows that have actions —
 * a read-only screen would otherwise spin up ~17 unused handlers on first paint.
 */
const SwipeableItemCard: React.FC<ItemCardProps> = ({
  id,
  title,
  subtitle,
  onPress,
  leftActions,
  rightActions,
  onSwipeableWillOpen,
  badge,
  rightElement,
  leftElement,
  accessibilityLabel,
  testID,
}) => {
  const { width: screenWidth } = useWindowDimensions();

  const { animatedSlideStyle, triggerSlide } = useSlideAnimation({
    itemId: id,
    slideDistance: screenWidth,
    duration: SLIDE_PRESETS.exitWithFade.duration,
    withOpacity: SLIDE_PRESETS.exitWithFade.withOpacity,
    opacityTarget: SLIDE_PRESETS.exitWithFade.opacityTarget,
  });

  // Each action declares whether it removes the row; a removing one slides out first.
  const withSlideOut = (actions?: SwipeAction[]) =>
    actions?.map(action =>
      action.removesRow
        ? { ...action, onPress: () => triggerSlide(1, action.onPress) }
        : action,
    );

  // The slide moves the whole card. The animated node takes no themed style,
  // and the sentinel keeps the card's theme through a later React commit.
  return (
    <Animated.View style={animatedSlideStyle}>
      <ThemeEpochSentinel />
      <RowCard testID={testID}>
        <SwipeableItem
          accessibilityLabel={
            accessibilityLabel ??
            accessibilityLabelOf(
              title,
              typeof subtitle === 'string' ? subtitle : undefined,
              badge?.text,
            )
          }
          onPress={onPress}
          leftActions={withSlideOut(leftActions)}
          rightActions={withSlideOut(rightActions)}
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
      </RowCard>
    </Animated.View>
  );
};

const ItemCardComponent: React.FC<ItemCardProps> = props => {
  const {
    title,
    subtitle,
    onPress,
    leftActions,
    rightActions,
    badge,
    rightElement,
    leftElement,
    accessibilityLabel,
    testID,
  } = props;

  const hasSwipeActions = !!leftActions?.length || !!rightActions?.length;

  // A row with no swipe actions can never slide, so skip the reanimated machinery
  // and the `Animated.View` wrapper entirely.
  if (!hasSwipeActions) {
    return (
      <RowCard testID={testID}>
        <ListItem
          title={title}
          subtitle={subtitle}
          onPress={onPress}
          badge={badge}
          rightElement={rightElement}
          leftElement={leftElement}
          accessibilityLabel={accessibilityLabel}
        />
      </RowCard>
    );
  }

  return <SwipeableItemCard {...props} />;
};

export const ItemCard = ItemCardComponent;
