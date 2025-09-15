import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
  SwipeableProps,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import {View, StyleProp, ViewStyle} from 'react-native';

export interface SwipeableRowProps extends Omit<SwipeableProps, 'children'> {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  containerStyle,
  renderLeftActions,
  renderRightActions,
  leftThreshold = 40,
  rightThreshold = 40,
  friction = 2,
  ...rest
}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <GestureHandlerRootView>
      <ReanimatedSwipeable
        friction={friction}
        leftThreshold={leftThreshold}
        rightThreshold={rightThreshold}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        containerStyle={[styles.swipeContainer, containerStyle]}
        {...rest}>
        <View style={styles.contentContainer}>{children}</View>
      </ReanimatedSwipeable>
    </GestureHandlerRootView>
  );
};

const stylesheet = createStyleSheet(theme => ({
  swipeContainer: {
    // make sure your swipeable row doesn't collapse
    overflow: 'hidden',
  },
  contentContainer: {
    // default padding/background can go here
    backgroundColor: '#FFF',
  },
}));
