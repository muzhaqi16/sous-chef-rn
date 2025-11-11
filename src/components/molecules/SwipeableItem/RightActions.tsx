import React from 'react';
import Reanimated, { SharedValue } from 'react-native-reanimated';
import { ActionButton } from './ActionButton';
import { useUnistyles } from 'react-native-unistyles';
import { styles } from './styles';
import { SwipeActionsProps } from './types';

interface RightActionsProps extends SwipeActionsProps {
  dragX: SharedValue<number>;
  progress: SharedValue<number>;
}

export const RightActions: React.FC<RightActionsProps> = React.memo(
  ({ onEdit, onDelete, onActionPress }) => {
    const { theme } = useUnistyles();
    return (
      <Reanimated.View style={styles.actionsContainer} pointerEvents="box-none">
        {onEdit && (
          <ActionButton
            onPress={() => onActionPress?.('edit')}
            icon="edit"
            backgroundColor={theme.colors.info}
            circular={true}
          />
        )}
        {onDelete && (
          <ActionButton
            onPress={() => onActionPress?.('delete')}
            icon="delete"
            backgroundColor={theme.colors.danger}
            circular={true}
          />
        )}
      </Reanimated.View>
    );
  },
);
