import React from 'react';
import { useTranslation } from '#/i18n';

import { Pressable } from '#components/atoms/themedComponents';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withSequence,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { TIMING } from '#constants/animations';
import { Icon } from '#/utils/iconUtils';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Text } from '#components/atoms/Text';
import type { TabIconPair } from './types';

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

  // Drive scale animation from shared value on the UI thread
  useAnimatedReaction(
    () => activeTabIndex.get() === tabIndex,
    (isActive, prevIsActive) => {
      if (isActive !== prevIsActive) {
        iconScale.set(
          withTiming(isActive ? 1.2 : 1, {
            duration: TIMING.FAST,
            easing: Easing.inOut(Easing.ease),
          }),
        );
      }
    },
  );

  const handlePress = () => {
    // Animate icon scale on press (squeeze then expand to active size)
    iconScale.set(
      withSequence(
        withTiming(0.85, {
          duration: TIMING.MICRO,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1.2, {
          duration: TIMING.MICRO,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
    );
    onPress();
  };

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.get() }],
  }));

  // The manifest stores an i18n key in options.title; resolve it here so the
  // tab label re-renders on language change.
  const label = options.title ? t(options.title) : route.name;
  // tone routes through withUnistyles(Ionicons) — only the Icon re-renders on
  // theme/brand-color changes, not the entire tab.
  const renderIcon = () => (
    <Icon
      name={isFocused ? icon.active : icon.inactive}
      size={24}
      tone={isFocused ? 'primary' : 'white'}
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
          size="xs"
          maxFontSizeMultiplier={1.2}
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
    color: theme.colors.white,
    marginTop: theme.spacing.xs,
    // A label that fits sizes to its own content and is centred by the tab's
    // `alignItems`. One that does NOT fit takes the full tab width instead, and
    // then the default left alignment puts it off to one side of its own icon —
    // which is what a long translation looked like. Centre the text so a label
    // sits under its icon whatever its width. `numberOfLines={1}` at the call
    // site is the other half: line count drives the tab's content height, so a
    // wrapping label lifts its own icon above the other three.
    textAlign: 'center',
    // The shared Text's `body` variant carries a 24px line height (md * 1.5);
    // at the 12px tab-label font that makes the text box twice the glyph
    // height, padding empty space below the label and pushing the icon+label
    // group upward so the bar reads top-heavy. Pin a snug line height (and drop
    // Android's extra font padding) so the box hugs the glyph and the group
    // centers evenly. The 1.3 ratio leaves room for descenders (y/p) and scales
    // with the font-size preference.
    lineHeight: theme.fonts.size.xs * 1.3,
    includeFontPadding: false,
  },
  tabLabelFocused: {
    color: theme.colors.primary,
  },
}));
