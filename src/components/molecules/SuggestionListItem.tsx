import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon, type IconLibrary } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { SLIDE_PRESETS } from '#constants/animations';

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
  /** Theme colors passed from parent to avoid per-item useUnistyles */
  themeColors?: {
    primary: string;
    textTertiary: string;
  };
  /** When false, always show placeholder icon regardless of imageUrl */
  showImage?: boolean;
}

const EXIT_CONFIG = SLIDE_PRESETS.exitWithFade;

/**
 * SuggestionListItem - Item row with image, title, subtitle, and quick-add button.
 *
 * Always wraps content in Animated.View so the component tree stays stable when
 * isExiting transitions. This prevents the flicker caused by unmounting/remounting.
 */
export const SuggestionListItem = ({
  imageUrl,
  title,
  subtitle,
  placeholderIcon = 'cube-outline',
  placeholderIconLibrary = 'Ionicons',
  onPress,
  onQuickAdd,
  quickAddDisabled = false,
  testID,
  isExiting = false,
  onExitComplete,
  themeColors,
  showImage = true,
}: SuggestionListItemProps) => {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const onExitCompleteRef = useRef(onExitComplete);
  useEffect(() => {
    onExitCompleteRef.current = onExitComplete;
  }, [onExitComplete]);

  // Pre-defined in RN runtime scope — scheduleOnRN requires this pattern
  const notifyExitComplete = () => {
    onExitCompleteRef.current?.();
  };

  useLayoutEffect(() => {
    if (isExiting) {
      translateX.set(
        withTiming(EXIT_CONFIG.slideDistance, {
          duration: EXIT_CONFIG.duration,
        }),
      );
      opacity.set(
        withTiming(
          EXIT_CONFIG.opacityTarget,
          { duration: EXIT_CONFIG.duration },
          finished => {
            'worklet';
            if (finished) {
              scheduleOnRN(notifyExitComplete);
            }
          },
        ),
      );
    } else {
      // Reset for error rollback — item reappears without animation
      translateX.set(0);
      opacity.set(1);
    }
  }, [isExiting, translateX, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const disabled = quickAddDisabled || isExiting;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (onQuickAdd) {
      onQuickAdd();
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={({ pressed }) => [styles.container, pressed && styles.pressed]}
        onPress={handlePress}
        disabled={!onPress && !onQuickAdd}
        testID={testID}
      >
        <View style={styles.imageContainer}>
          {showImage && imageUrl ? (
            <CachedImage uri={imageUrl} style={styles.image} displaySize={40} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Icon
                name={placeholderIcon}
                size={20}
                color={
                  themeColors?.primary ?? styles.quickAddButton.backgroundColor
                }
                library={placeholderIconLibrary}
              />
            </View>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {!!onQuickAdd && (
          <Pressable
            style={({ pressed }) => [
              styles.quickAddButton,
              pressed && styles.pressed,
            ]}
            onPress={onQuickAdd}
            disabled={disabled}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon
              name="add"
              size={20}
              color={
                disabled
                  ? themeColors?.textTertiary ?? '#999'
                  : themeColors?.primary ?? '#007AFF'
              }
            />
          </Pressable>
        )}
      </Pressable>
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
