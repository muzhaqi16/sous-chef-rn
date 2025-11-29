import React from 'react';
import Reanimated from 'react-native-reanimated';
import { ActionButton } from './ActionButton';
import { useUnistyles } from 'react-native-unistyles';
import { styles } from './styles';
import { SwipeActionsProps } from './types';

export const RightActions: React.FC<SwipeActionsProps> = React.memo(
  ({ onEdit, onDelete, onActionPress, testIDPrefix }) => {
    const { theme } = useUnistyles();
    return (
      <Reanimated.View style={styles.actionsContainer} pointerEvents="box-none">
        {onEdit && (
          <ActionButton
            onPress={() => onActionPress?.('edit')}
            icon="edit"
            backgroundColor={theme.colors.info}
            circular={true}
            testID={testIDPrefix ? `${testIDPrefix}-edit` : undefined}
          />
        )}
        {onDelete && (
          <ActionButton
            onPress={() => onActionPress?.('delete')}
            icon="delete"
            backgroundColor={theme.colors.danger}
            circular={true}
            testID={testIDPrefix ? `${testIDPrefix}-delete` : undefined}
          />
        )}
      </Reanimated.View>
    );
  },
);
