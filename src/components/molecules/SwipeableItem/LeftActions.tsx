import React from 'react';
import Reanimated from 'react-native-reanimated';
import { ActionButton } from './ActionButton';
import { styles } from './styles';
import { SwipeActionsProps } from './types';
import { SharedValue } from 'react-native-reanimated';

interface LeftActionsProps extends SwipeActionsProps {
  dragX: SharedValue<number>;
  progress: SharedValue<number>;
}

export const LeftActions: React.FC<LeftActionsProps> = ({}) => {
  // Always show left actions for consistency (placeholder for now)
  return (
    <Reanimated.View style={styles.leftActionsContainer}>
      <ActionButton
        onPress={() => {
          /* placeholder action */
        }}
        icon="favorite"
        backgroundColor="transparent"
        circular={true}
      />
    </Reanimated.View>
  );
};
