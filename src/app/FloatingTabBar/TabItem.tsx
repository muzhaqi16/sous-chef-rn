import React from 'react';
import { useTranslation } from '#/i18n';

import { Pressable } from '#components/atoms/themedComponents';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSequence,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

import { Icon } from '#/utils/iconUtils';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Text } from '#components/atoms/Text';
import type { TabIconPair } from './types';
import { motion } from '#/theme/foundations/motion';

/** Shown when a route arrives with no appearance entry — a wiring mistake, not
 *  a state the app should reach, so it renders as one rather than crashing. */
const UNKNOWN_TAB_ICON: TabIconPair = {
  active: 'help-circle',
  inactive: 'help-circle',
};

interface TabItemProps {
  route: {
    key: string;
    name: string;
    params?: object;
  };
  isFocused: boolean;
  options: Pick<
    BottomTabNavigationOptions,
    'title' | 'tabBarAccessibilityLabel'
  >;
  onPress: () => void;
  /** Icons for this tab, from the owning feature's manifest. */
  icon?: TabIconPair;
  showLabel: boolean;
  activeTabIndex: SharedValue<number>;
  tabIndex: number;
}

export const TabItem: React.FC<TabItemProps> = ({
  route,
  isFocused,
  options,
  onPress,
  icon = UNKNOWN_TAB_ICON,
  showLabel,
  activeTabIndex,
  tabIndex,
}) => {
  const { t } = useTranslation();
  const iconScale = useSharedValue(isFocused ? 1.2 : 1);

  useAnimatedReaction(
    () => activeTabIndex.get() === tabIndex,
    (isActive, prevIsActive) => {
      if (isActive !== prevIsActive) {
        iconScale.set(
          withTiming(isActive ? 1.2 : 1, {
            duration: motion.timing.FAST,
            easing: motion.easing.emphasized,
          }),
        );
      }
    },
  );

  const handlePress = () => {
    iconScale.set(
      withSequence(
        withTiming(0.85, {
          duration: motion.timing.MICRO,
          easing: motion.easing.emphasized,
        }),
        withTiming(1.2, {
          duration: motion.timing.MICRO,
          easing: motion.easing.emphasized,
        }),
      ),
    );
    onPress();
  };

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.get() }],
  }));

  // The manifest stores an i18n key in options.title; resolving it here is what
  // makes the label re-render on a language change.
  const label = options.title ? t(options.title) : route.name;
  // `tone` routes through withUnistyles(Ionicons), so a theme change re-renders
  // only the Icon, not the whole tab.
  const renderIcon = () => (
    <Icon
      name={isFocused ? icon.active : icon.inactive}
      size={24}
      tone={isFocused ? 'primary' : 'textSecondary'}
    />
  );

  return (
    <Pressable
      testID={`tab-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={options.tabBarAccessibilityLabel}
      onPress={handlePress}
      style={styles.tabItem}
    >
      <Animated.View style={animatedIconStyle}>{renderIcon()}</Animated.View>
      {!!showLabel && (
        <Text
          role="caption"
          numberOfLines={1}
          style={[styles.tabLabel, isFocused && styles.tabLabelFocused]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
};

TabItem.displayName = 'TabItem';

const styles = StyleSheet.create(theme => ({
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minWidth: theme.sizes.touchTarget.sm,
  },
  tabLabel: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    // A label too wide to fit takes the full tab width, where the default left
    // alignment puts it off to one side of its own icon — so centre it. The call
    // site's `numberOfLines={1}` is the other half: a wrapping label would grow
    // the tab's content height and lift its icon above the other three.
    textAlign: 'center',
    // The shared `body` variant's 24px leading is twice the glyph height at the
    // 12px tab font, padding the box and pushing the group upward. The 1.3 ratio
    // hugs the glyph, leaves room for descenders, and scales with the preference.
    includeFontPadding: false,
  },
  tabLabelFocused: {
    color: theme.colors.primary,
  },
}));
