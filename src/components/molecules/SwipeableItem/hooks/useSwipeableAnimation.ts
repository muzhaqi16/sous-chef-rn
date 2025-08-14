import {useSharedValue, withTiming, runOnJS} from 'react-native-reanimated';

export const useSwipeableAnimation = (onDelete?: () => void) => {
  const itemOpacity = useSharedValue(1);
  const itemHeight = useSharedValue<number | 'auto'>('auto');

  const animateDelete = () => {
    'worklet';
    itemOpacity.value = withTiming(0, {duration: 300});
    itemHeight.value = withTiming(0, {duration: 300}, () => {
      'worklet';
      if (onDelete) {
        runOnJS(onDelete)();
      }
    });
  };

  return {
    itemOpacity,
    itemHeight,
    animateDelete,
  };
};
