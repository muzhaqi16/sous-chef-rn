import React from 'react';
import { TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, IconName, IconLibrary } from '#utils/iconUtils';
import { useTabBarVisibility } from '#/context/TabBarVisibilityContext';
import { TAB_BAR_HEIGHT } from '../navigation/AnimatedTabBar';

interface FABProps {
  onPress?: () => void;
  icon?: IconName;
  library?: IconLibrary;
  position?: { bottom?: number; right?: number; left?: number; top?: number };
}

export const FAB: React.FC<FABProps> = ({
  onPress = () => {},
  icon = 'add',
  library = 'MaterialIcons',
  position = { bottom: 20, right: 20 },
}) => {
  const { isVisible } = useTabBarVisibility();
  const { bottom: safeBottom } = useSafeAreaInsets();

  // Calculate position above tab bar
  const fabPosition = React.useMemo(() => ({
    ...position,
    bottom: TAB_BAR_HEIGHT + safeBottom + (position.bottom || 20),
  }), [position, safeBottom]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSpring(isVisible.value ? 1 : 0, {
            damping: 15,
            stiffness: 150,
            overshootClamping: true,
          }),
        },
      ],
    };
  }, []);

  return (
    <Animated.View style={[styles.fab, fabPosition, animatedStyle]}>
      <TouchableOpacity style={styles.fabButton} onPress={onPress}>
        <Icon name={icon} size={24} color="white" library={library} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 999, // Just below the tab bar but above everything else
  },
  fabButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
  },
}));
