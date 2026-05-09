import React from 'react';
import Animated from 'react-native-reanimated';
import { AnimatedActionButton } from './AnimatedActionButton';
import { HapticService } from '#/services/haptic/HapticService';
import { styles } from './styles';
import { SwipeActionsProps } from './types';

// Calculate container width based on number of buttons
const getContainerWidth = (buttonCount: number): number => {
  if (buttonCount === 1) return 80;
  if (buttonCount === 2) return 120;
  return 180; // 3 buttons
};

const RightActionsComponent: React.FC<SwipeActionsProps> = ({
  onEdit,
  onDelete,
  onActionPress,
  testIDPrefix,
  progress,
  swipeMode,
}) => {
  // Shopping mode: Only show delete on right (edit is on left swipe)
  if (swipeMode === 'shopping') {
    if (!onDelete) return null;

    const handleDeletePress = () => {
      HapticService.light();
      onActionPress?.('delete');
    };

    return (
      <Animated.View
        style={[styles.actionsContainer, { width: getContainerWidth(1) }]}
        pointerEvents="box-none"
      >
        <AnimatedActionButton
          onPress={handleDeletePress}
          icon="trash-outline"
          circular={true}
          testID={testIDPrefix ? `${testIDPrefix}-delete` : undefined}
          progress={progress}
          index={0}
        />
      </Animated.View>
    );
  }

  // Default mode: Show edit and/or delete
  const hasEdit = !!onEdit;
  const hasDelete = !!onDelete;
  const buttonCount = (hasEdit ? 1 : 0) + (hasDelete ? 1 : 0);

  if (buttonCount === 0) return null;

  const handleEditPress = () => {
    HapticService.light();
    onActionPress?.('edit');
  };

  const handleDeletePress = () => {
    HapticService.light();
    onActionPress?.('delete');
  };

  return (
    <Animated.View
      style={[
        styles.actionsContainer,
        { width: getContainerWidth(buttonCount) },
      ]}
      pointerEvents="box-none"
    >
      {!!onEdit && (
        <AnimatedActionButton
          onPress={handleEditPress}
          icon="create-outline"
          circular={true}
          testID={testIDPrefix ? `${testIDPrefix}-edit` : undefined}
          progress={progress}
          index={0}
        />
      )}
      {!!onDelete && (
        <AnimatedActionButton
          onPress={handleDeletePress}
          icon="trash-outline"
          circular={true}
          testID={testIDPrefix ? `${testIDPrefix}-delete` : undefined}
          progress={progress}
          index={hasEdit ? 1 : 0}
        />
      )}
    </Animated.View>
  );
};

export const RightActions = RightActionsComponent;
