import React from 'react';
import Reanimated from 'react-native-reanimated';
import { AnimatedActionButton } from './AnimatedActionButton';
import { useUnistyles } from 'react-native-unistyles';
import { styles } from './styles';
import { SwipeActionsProps } from './types';

// Calculate container width based on number of buttons
const getContainerWidth = (buttonCount: number): number => {
  if (buttonCount === 1) return 80;
  if (buttonCount === 2) return 120;
  return 180; // 3 buttons
};

export const RightActions: React.FC<SwipeActionsProps> = React.memo(
  ({ onEdit, onDelete, onActionPress, testIDPrefix, progress, swipeMode }) => {
    const { theme } = useUnistyles();

    // Shopping mode: Only show delete on right (edit is on left swipe)
    if (swipeMode === 'shopping') {
      if (!onDelete) return null;

      return (
        <Reanimated.View
          style={[styles.actionsContainer, { width: getContainerWidth(1) }]}
          pointerEvents="box-none"
        >
          <AnimatedActionButton
            onPress={() => onActionPress?.('delete')}
            icon="delete"
            backgroundColor={theme.colors.danger}
            circular={true}
            testID={testIDPrefix ? `${testIDPrefix}-delete` : undefined}
            progress={progress}
            index={0}
          />
        </Reanimated.View>
      );
    }

    // Default mode: Show edit and/or delete
    const hasEdit = !!onEdit;
    const hasDelete = !!onDelete;
    const buttonCount = (hasEdit ? 1 : 0) + (hasDelete ? 1 : 0);

    if (buttonCount === 0) return null;

    return (
      <Reanimated.View
        style={[styles.actionsContainer, { width: getContainerWidth(buttonCount) }]}
        pointerEvents="box-none"
      >
        {onEdit && (
          <AnimatedActionButton
            onPress={() => onActionPress?.('edit')}
            icon="edit"
            backgroundColor={theme.colors.info}
            circular={true}
            testID={testIDPrefix ? `${testIDPrefix}-edit` : undefined}
            progress={progress}
            index={0}
          />
        )}
        {onDelete && (
          <AnimatedActionButton
            onPress={() => onActionPress?.('delete')}
            icon="delete"
            backgroundColor={theme.colors.danger}
            circular={true}
            testID={testIDPrefix ? `${testIDPrefix}-delete` : undefined}
            progress={progress}
            index={hasEdit ? 1 : 0}
          />
        )}
      </Reanimated.View>
    );
  },
);
