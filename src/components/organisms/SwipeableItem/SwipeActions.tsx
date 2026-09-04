import React from 'react';
import Animated from 'react-native-reanimated';
import { HapticService } from '#/services/haptic/HapticService';
import { SwipeActionButton } from '#components/organisms/SwipeableItem/SwipeActionButton';
import { styles } from '#components/organisms/SwipeableItem/styles';
import type { SwipeActionsProps } from '#components/organisms/SwipeableItem/types';

/**
 * Width of the revealed tray, sized in steps rather than measured: the
 * placeholder in `SwipeableItem` must predict the same number before the real
 * tray mounts, and both read it from here.
 */
export const swipeTrayWidth = (buttonCount: number): number => {
  if (buttonCount <= 1) return 80;
  if (buttonCount === 2) return 120;
  return 180;
};

/** Renders one edge's action tray; only the container style differs by side. */
export const SwipeActions: React.FC<SwipeActionsProps> = ({
  actions,
  side,
  swipeableRef,
  progress,
}) => {
  if (actions.length === 0) return null;

  return (
    <Animated.View
      style={[
        side === 'left' ? styles.leftActionsContainer : styles.actionsContainer,
        { width: swipeTrayWidth(actions.length) },
      ]}
      pointerEvents="box-none"
    >
      {actions.map((action, index) => (
        <SwipeActionButton
          key={action.key}
          onPress={() => {
            // Confirms the swipe registered. Opt-out is per action: one that
            // opens its own confirming surface would buzz twice.
            if (action.haptic !== false) HapticService.light();
            swipeableRef?.current?.close();
            action.onPress();
          }}
          icon={action.icon}
          circular={true}
          testID={action.testID}
          progress={progress}
          index={index}
        />
      ))}
    </Animated.View>
  );
};
