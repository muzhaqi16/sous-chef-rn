import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Icon, type IconLibrary } from '#utils/iconUtils';

export interface SuggestionListItemProps {
  imageUrl?: string | null;
  title: string;
  subtitle?: string | null;
  placeholderIcon?: string;
  placeholderIconLibrary?: IconLibrary;
  onPress?: () => void;
  onQuickAdd?: () => void;
  quickAddDisabled?: boolean;
  testID?: string;
  /** When true, play exit animation (slide right + fade out) */
  isExiting?: boolean;
  /** Called after exit animation completes */
  onExitComplete?: () => void;
}

/**
 * SuggestionListItem - Item row with image, title, subtitle, and quick-add button
 *
 * Used for displaying item suggestions in bottom sheets for:
 * - Pantry add suggestions (low stock, expiring soon, frequently added, etc.)
 * - Shopping list suggestions
 * - Search results with quick-add functionality
 *
 * Features:
 * - Image with placeholder fallback using configurable icon
 * - Title and optional subtitle (typically category)
 * - Quick add button on the right side
 */
const EXIT_ANIMATION_DURATION = 250;

export const SuggestionListItem: React.FC<SuggestionListItemProps> = ({
  imageUrl,
  title,
  subtitle,
  placeholderIcon = 'inventory-2',
  placeholderIconLibrary = 'MaterialIcons',
  onPress,
  onQuickAdd,
  quickAddDisabled = false,
  testID,
  isExiting = false,
  onExitComplete,
}) => {
  const { theme } = useUnistyles();

  // Animation shared values
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Store callback in ref to avoid stale closure issues
  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;

  // Trigger exit animation when isExiting becomes true
  useEffect(() => {
    if (isExiting) {
      translateX.value = withTiming(100, { duration: EXIT_ANIMATION_DURATION });
      opacity.value = withTiming(0, { duration: EXIT_ANIMATION_DURATION });

      // Call onExitComplete after animation duration
      const timer = setTimeout(() => {
        onExitCompleteRef.current?.();
      }, EXIT_ANIMATION_DURATION);

      return () => clearTimeout(timer);
    }
  }, [isExiting, translateX, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (onQuickAdd) {
      onQuickAdd();
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        disabled={!onPress && !onQuickAdd || isExiting}
        testID={testID}
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon
                name={placeholderIcon}
                size={20}
                color={theme.colors.primary}
                library={placeholderIconLibrary}
              />
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {onQuickAdd && (
          <TouchableOpacity
            style={styles.quickAddButton}
            onPress={onQuickAdd}
            disabled={quickAddDisabled || isExiting}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name="add"
              size={20}
              color={quickAddDisabled || isExiting ? theme.colors.textTertiary : theme.colors.primary}
              library="MaterialIcons"
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  imageContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.sm,
    overflow: 'hidden',
    marginRight: theme.spacing.md,
  },
  image: {
    width: 40,
    height: 40,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: 40,
    height: 40,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  quickAddButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
