import React from 'react';
import Reanimated, { SharedValue } from 'react-native-reanimated';
import { ActionButton } from './ActionButton';
import { styles } from './styles';
import { SwipeActionsProps } from './types';

interface RightActionsProps extends SwipeActionsProps {
  dragX: SharedValue<number>;
  progress: SharedValue<number>;
}

export const RightActions: React.FC<RightActionsProps> = React.memo(({
  onEdit,
  onDelete,
  onActionPress,
}) => {
  return (
    <Reanimated.View
      style={styles.actionsContainer}
      pointerEvents="box-none"
    >
      {onEdit && (
        <ActionButton
          onPress={() => onActionPress?.('edit')}
          icon="edit"
          backgroundColor="transparent"
          circular={true}
        />
      )}
      {onDelete && (
        <ActionButton
          onPress={() => onActionPress?.('delete')}
          icon="delete"
          backgroundColor="transparent"
          circular={true}
        />
      )}
    </Reanimated.View>
  );
});
