import React from 'react';
import Reanimated, {useAnimatedStyle} from 'react-native-reanimated';
import {ActionButton} from './ActionButton';
import {stylesheet} from './styles';
import {SwipeActionsProps} from './types';
import {useStyles} from 'react-native-unistyles';

interface RightActionsProps extends SwipeActionsProps {
  dragX: Reanimated.SharedValue<number>;
  progress: Reanimated.SharedValue<number>;
}

export const RightActions: React.FC<RightActionsProps> = ({
  dragX,
  progress,
  onEdit,
  onDelete,
  onActionPress,
}) => {
  const {styles} = useStyles(stylesheet);

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
