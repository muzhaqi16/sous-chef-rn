import React, {ReactNode} from 'react';
import {Text, StyleSheet} from 'react-native';

import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

function RightAction(prog: SharedValue<number>, drag: SharedValue<number>) {
  const styleAnimation = useAnimatedStyle(() => {
    // console.log('showRightProgress:', prog.value);
    // console.log('appliedTranslation:', drag.value);
    return {
      transform: [{translateX: drag.value + 50}],
    };
  });

  return (
    <Reanimated.View style={styleAnimation}>
      <Text style={styles.rightAction}>Text</Text>
    </Reanimated.View>
  );
}

export default function SwipeableRow({children}: {children: ReactNode}) {
  return (
    <ReanimatedSwipeable
      containerStyle={styles.swipeable}
      friction={2}
      enableTrackpadTwoFingerGesture
      rightThreshold={40}
      renderRightActions={RightAction}>
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  rightAction: {width: 50, height: 50, backgroundColor: 'purple'},
  separator: {
    width: '100%',
    borderTopWidth: 1,
  },
  swipeable: {
    alignItems: 'center',
  },
});
