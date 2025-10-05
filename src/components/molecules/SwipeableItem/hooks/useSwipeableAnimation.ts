import {useSharedValue, withTiming} from 'react-native-reanimated';

export const useSwipeableAnimation = () => {
  const itemOpacity = useSharedValue(1);

  const animateDelete = () => {
    'worklet';
    itemOpacity.value = withTiming(0, {duration: 300});
  };

  return {
    itemOpacity,
    animateDelete,
  };
};
