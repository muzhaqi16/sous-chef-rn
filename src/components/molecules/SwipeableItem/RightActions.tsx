import React from 'react';
import Reanimated, {useAnimatedStyle, SharedValue} from 'react-native-reanimated';
import {ActionButton} from './ActionButton';
import {styles} from './styles';
import {SwipeActionsProps} from './types';

interface RightActionsProps extends SwipeActionsProps {
  dragX: SharedValue<number>;
  progress: SharedValue<number>;
}

export const RightActions: React.FC<RightActionsProps> = ({
  dragX,
  progress,
  onEdit,
  onDelete,
  onActionPress,
}) => {
  const translateX = useAnimatedStyle(() => {
    return {
      transform: [{translateX: dragX.value + 120}],
    };
  });

  return (
    <Reanimated.View style={[styles.actionsContainer, translateX]}>
      {onEdit && (
        <ActionButton
          onPress={() => onActionPress('edit')}
          icon="edit"
          backgroundColor="#4CAF50"
        />
      )}
      {onDelete && (
        <ActionButton
          onPress={() => onActionPress('delete')}
          icon="delete"
          backgroundColor="#F44336"
        />
      )}
    </Reanimated.View>
  );
};
