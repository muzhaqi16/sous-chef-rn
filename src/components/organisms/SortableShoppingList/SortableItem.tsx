import React, { useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

interface SimpleDraggableItemProps {
  item: {
    id: string;
    title: string;
    subtitle: string;
    badge?: {
      text: string;
      variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
    };
    rightElement?: React.ReactNode;
    leftElement?: React.ReactNode;
  };
  index: number;
  itemHeight: number;
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragHover: (index: number) => void;
  isDragged: boolean;
  disabled?: boolean;
}

export const SimpleDraggableItem: React.FC<SimpleDraggableItemProps> = ({
  item,
  index,
  itemHeight,
  onItemPress,
  onDragStart,
  onDragEnd,
  isDragged: _isDragged,
  disabled = false,
}) => {
  // Animation values
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Track initial drag position
  const startY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const handleDragStart = useCallback(() => {
    onDragStart(index);
  }, [onDragStart, index]);

  const handleDragEnd = useCallback((fromIndex: number, toIndex: number) => {
    onDragEnd(fromIndex, toIndex);
  }, [onDragEnd]);

  // Simple pan gesture
  const panGesture = Gesture.Pan()
    .activateAfterLongPress(600)
    .enabled(!disabled)
    .onStart(() => {
      isDragging.value = true;
      startY.value = translateY.value;

      // Visual feedback
      scale.value = withSpring(1.05);
      opacity.value = withTiming(0.9);

      // Notify parent
      runOnJS(handleDragStart)();
    })
    .onUpdate((event) => {
      // Update position
      translateY.value = startY.value + event.translationY;
    })
    .onEnd((event) => {
      isDragging.value = false;

      // Calculate target index based on movement
      const movement = event.translationY;
      const indexChange = Math.round(movement / itemHeight);
      const targetIndex = Math.max(0, index + indexChange);

      // Reset visual state
      scale.value = withSpring(1);
      opacity.value = withTiming(1);
      translateY.value = withSpring(0);

      // Notify parent if position changed
      if (targetIndex !== index) {
        runOnJS(handleDragEnd)(index, targetIndex);
      }
    });

  // Only use pan gesture for drag functionality
  // Tap navigation will be handled by TouchableOpacity

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
      zIndex: isDragging.value ? 1000 : 1,
      elevation: isDragging.value ? 8 : 2,
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, { height: itemHeight }, animatedStyle]}>
        <View style={styles.itemContent}>
          {/* Clickable content area - excludes right element */}
          <TouchableOpacity
            style={styles.clickableArea}
            onPress={() => onItemPress(item.id)}
            activeOpacity={0.7}
            disabled={disabled}
          >
            {/* Left element (image or placeholder) */}
            <View style={styles.leftElement}>
              {item.leftElement || <View style={styles.leftPlaceholder} />}
            </View>

            {/* Main content */}
            <View style={styles.contentContainer}>
              <Text style={styles.title} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.subtitle}
              </Text>
              {item.badge && (
                <View style={[styles.badge, styles[`badge${item.badge.variant || 'default'}`]]}>
                  <Text style={styles.badgeText}>{item.badge.text}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Right element (checkbox, etc.) - separate from clickable area */}
          {item.rightElement && (
            <View style={styles.rightElement}>
              {item.rightElement}
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  itemContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  clickableArea: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  leftElement: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftPlaceholder: {
    width: 60,
    height: 60,
    marginRight: 16,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 60,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgedefault: {
    backgroundColor: '#e5e5e5',
  },
  badgeprimary: {
    backgroundColor: '#007AFF',
  },
  badgesuccess: {
    backgroundColor: '#4CAF50',
  },
  badgewarning: {
    backgroundColor: '#FF9800',
  },
  badgedanger: {
    backgroundColor: '#F44336',
  },
  badgeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  rightElement: {
    marginLeft: 12,
  },
});