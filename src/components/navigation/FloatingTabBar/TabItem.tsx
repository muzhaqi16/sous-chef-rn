import React from 'react';
import { useTranslation } from 'react-i18next';

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

const TAB_ICON_MAP: Record<string, [string, string]> = {
  Pantry: ['home', 'home-outline'],
  ShoppingList: ['list', 'list-outline'],
  Recipe: ['book', 'book-outline'],
  MealPlan: ['calendar', 'calendar-outline'],
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
  showLabel: boolean;
  activeTabIndex: SharedValue<number>;
  tabIndex: number;
}

export const TabItem: React.FC<TabItemProps> = ({
  route,
  isFocused,
  options,
  onPress,
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
    [tabIndex],
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
  const [activeIcon, inactiveIcon] = TAB_ICON_MAP[route.name] || [
    'help-circle',
    'help-circle',
  ];

  // tone routes through withUnistyles(Ionicons) — only the Icon re-renders on
  // theme/brand-color changes, not the entire tab.
  const renderIcon = () => (
    <Icon
      name={isFocused ? activeIcon : inactiveIcon}
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
