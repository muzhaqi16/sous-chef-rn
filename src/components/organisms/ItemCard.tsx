import React, { useCallback } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { SwipeableItem } from '#components/molecules/SwipeableItem/SwipeableItem';
import { ListItem } from '../molecules/ListItem';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { useSlideAnimation } from '#hooks/animations/useSlideAnimation';
import { SLIDE_PRESETS } from '#/constants/animations';

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
  onSwipeableWillOpen?: (ref: any) => void;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode; // Optional left element for image or icon
  testID?: string;
}

const ItemCardComponent: React.FC<ItemCardProps> = ({
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

  // Wrap delete action with slide animation
  const handleDelete = useCallback(() => {
    if (onDelete) {
      triggerSlide(1, onDelete);
    }
  }, [onDelete, triggerSlide]);

  // Wrap consume action with slide animation
  const handleConsume = useCallback(() => {
    if (onConsume) {
      triggerSlide(1, onConsume);
    }
  }, [onConsume, triggerSlide]);

  // Wrap waste action with slide animation
  const handleWaste = useCallback(() => {
    if (onWaste) {
      triggerSlide(1, onWaste);
    }
  }, [onWaste, triggerSlide]);

  const innerContent =
    onEdit || onDelete || onConsume || onWaste || onRestock ? (
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
    ) : (
      <ListItem
        title={title}
        subtitle={subtitle}
        onPress={onPress}
        badge={badge}
        rightElement={rightElement}
        leftElement={leftElement}
      />
    );

  return (
    <Animated.View style={[commonStyles.shadow, styles.container, animatedSlideStyle]} testID={testID}>
      {innerContent}
    </Animated.View>
  );
};

export const ItemCard = ItemCardComponent;

const styles = StyleSheet.create(theme => ({
  container: {
    opacity: 1, // Prevent transparency inheritance
    // Horizontal margin for shadow visibility
    marginHorizontal: theme.spacing.md,
    // Half vertical margin so stacked items merge to full spacing (md/2 + md/2 = md)
    marginVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    boxSizing: 'border-box',
  },
}));
