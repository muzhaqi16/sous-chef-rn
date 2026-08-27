import React from 'react';
import Animated from 'react-native-reanimated';
import { HapticService } from '#/services/haptic/HapticService';
import { SwipeActionButton } from './SwipeActionButton';
import { styles } from './styles';
import type { SwipeActionsProps } from './types';

/**
 * Width of the revealed tray. Each circular button is ~45dp plus 4dp of margin
 * either side, so the tray is sized in steps rather than measured — the
 * placeholder in `SwipeableItem` has to predict the same number before the real
 * tray mounts, and both read it from here.
 */
export const swipeTrayWidth = (buttonCount: number): number => {
  if (buttonCount <= 1) return 80;
  if (buttonCount === 2) return 120;
  return 180;
};

/**
 * Renders one edge's action tray.
 *
 * Left and right used to be separate components, ~180 and ~100 lines, each a
 * chain of `if (onConsume && onWaste && onRestock)`-style branches enumerating
 * every combination its two callers happened to use. The tray is the same
 * either side; only the container style differs.
 */
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
