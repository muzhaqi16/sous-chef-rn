import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Icon, type IconLibrary } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';

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
}

const EXIT_ANIMATION_DURATION = 250;

/**
 * Static item content — no animation hooks, no shared values.
 */
const SuggestionListItemContent = React.memo<
  Omit<SuggestionListItemProps, 'isExiting' | 'onExitComplete'>
>(({
  imageUrl,
  title,
  subtitle,
  placeholderIcon = 'cube-outline',
  placeholderIconLibrary = 'Ionicons',
  onPress,
  onQuickAdd,
  quickAddDisabled = false,
  testID,
  themeColors,
}) => {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (onQuickAdd) {
      onQuickAdd();
    }
  };

  return (
    <Pressable
      style={({pressed}) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
      disabled={!onPress && !onQuickAdd}
      testID={testID}
    >
      <View style={styles.imageContainer}>
        {imageUrl ? (
          <CachedImage uri={imageUrl} style={styles.image} displaySize={40} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Icon
              name={placeholderIcon}
              size={20}
              color={themeColors?.primary ?? styles.quickAddButton.backgroundColor}
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
          style={({pressed}) => [styles.quickAddButton, pressed && styles.pressed]}
          onPress={onQuickAdd}
          disabled={quickAddDisabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            name="add"
            size={20}
            color={quickAddDisabled ? (themeColors?.textTertiary ?? '#999') : (themeColors?.primary ?? '#007AFF')}
          />
        </Pressable>
      )}
    </Pressable>
  );
});

SuggestionListItemContent.displayName = 'SuggestionListItemContent';

/**
 * Animated wrapper — only mounted when isExiting=true.
 * Creates shared values only when exit animation is needed.
 */
const ExitAnimationWrapper: React.FC<{
  onExitComplete?: () => void;
  children: React.ReactNode;
}> = ({ onExitComplete, children }) => {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const onExitCompleteRef = useRef(onExitComplete);
  onExitCompleteRef.current = onExitComplete;

  useEffect(() => {
    translateX.set(withTiming(100, { duration: EXIT_ANIMATION_DURATION }));
    opacity.set(withTiming(0, { duration: EXIT_ANIMATION_DURATION }));

    const timer = setTimeout(() => {
      onExitCompleteRef.current?.();
    }, EXIT_ANIMATION_DURATION);

    return () => clearTimeout(timer);
  }, [translateX, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

/**
 * SuggestionListItem - Item row with image, title, subtitle, and quick-add button.
 *
 * Conditionally wraps with exit animation only when isExiting is true,
 * avoiding unnecessary Reanimated shared value creation for non-exiting items.
 */
export const SuggestionListItem = React.memo<SuggestionListItemProps>(({
  isExiting = false,
  onExitComplete,
  ...contentProps
}) => {
  if (isExiting) {
    return (
      <ExitAnimationWrapper onExitComplete={onExitComplete}>
        <SuggestionListItemContent {...contentProps} quickAddDisabled />
      </ExitAnimationWrapper>
    );
  }
  return <SuggestionListItemContent {...contentProps} />;
});

SuggestionListItem.displayName = 'SuggestionListItem';

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
