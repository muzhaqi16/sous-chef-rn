import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
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
import { Text } from '#components/atoms/Text';

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
    transform: [{ translateX: translateX.get() }],
    opacity: opacity.get(),
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
        {!!showImage && (
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <CachedImage
                uri={imageUrl}
                style={styles.image}
                displaySize={40}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon
                  name={placeholderIcon}
                  size={20}
                  tone="primary"
                  library={placeholderIconLibrary}
                />
              </View>
            )}
          </View>
        )}
        <View style={styles.info}>
          <Text size="base" weight="medium" numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text
              size="sm"
              tone="secondary"
              style={styles.subtitle}
              numberOfLines={1}
            >
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
              tone={disabled ? 'iconDisabled' : 'primary'}
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
  subtitle: {
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
