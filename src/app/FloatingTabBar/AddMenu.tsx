import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, BackHandler, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { SHEET } from '#/constants/animations';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { motion } from '#/theme/foundations/motion';
import type { TabBarAddAction } from '#context/TabBarActionsContext';
import { kitTestIDs } from '#components/testIDs';

interface AddMenuProps {
  actions: readonly TabBarAddAction[];
  open: boolean;
  /** 0 closed → 1 open, shared with the `+` it rotates. */
  progress: SharedValue<number>;
  /** Distance from the window's bottom to the `+`. */
  buttonBottom: number;
  onClose: () => void;
}

const STAGGER_MS = 30;

/**
 * The `+`'s menu: a scrim over the screen and the bar, the entries stacked
 * above the `+`, which stays on top as the close control. It paints its own
 * scrim because the global backdrop renders above the whole navigation tree,
 * and so above the `+`.
 */
export const AddMenu: React.FC<AddMenuProps> = ({
  actions,
  open,
  progress,
  buttonBottom,
  onClose,
}) => {
  const firstEntryRef = useRef<View>(null);

  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );
    const first = firstEntryRef.current;
    if (first) AccessibilityInfo.sendAccessibilityEvent(first, 'focus');
    return () => subscription.remove();
  }, [open, onClose]);

  // The animated node takes no themed style, so the colour sits one level
  // down; the bar's layer, so the scrim covers the bar and not the `+`.
  const animatedTheme = useAnimatedTheme();
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: progress.get() * SHEET.BACKDROP_OPACITY,
    zIndex: animatedTheme.get().zIndex.overlay,
  }));

  // Listed nearest the `+` first, so the first entry sits lowest.
  const stacked = [...actions].reverse();

  return (
    <>
      {/* Never a screen-reader stop: the `+`, now Close, and Back dismiss it. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, scrimStyle]}
        pointerEvents={open ? 'auto' : 'none'}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Pressable
          testID={kitTestIDs.tabBarAddMenuScrim}
          style={styles.scrim}
          onPress={onClose}
          accessible={false}
        />
      </Animated.View>
      {open ? (
        <View style={styles.menu(buttonBottom)} accessibilityRole="menu">
          {stacked.map((action, index) => (
            <Animated.View
              key={action.key}
              entering={FadeInDown.duration(motion.timing.FAST).delay(
                (stacked.length - 1 - index) * STAGGER_MS,
              )}
              exiting={FadeOut.duration(motion.timing.INSTANT)}
            >
              <Pressable
                ref={index === stacked.length - 1 ? firstEntryRef : undefined}
                testID={action.testID}
                style={styles.entry}
                disabled={!!action.disabledReason}
                accessibilityRole="menuitem"
                accessibilityLabel={
                  action.disabledReason
                    ? `${action.label}, ${action.disabledReason}`
                    : action.label
                }
                accessibilityState={{ disabled: !!action.disabledReason }}
                onPress={() => {
                  onClose();
                  action.onPress();
                }}
              >
                <View style={styles.labelPill}>
                  <Text
                    role="label"
                    tone={action.disabledReason ? 'tertiary' : 'primary'}
                  >
                    {action.label}
                  </Text>
                  {action.disabledReason ? (
                    <Text role="footnote" tone="secondary">
                      {action.disabledReason}
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.entryButton,
                    action.disabledReason ? styles.entryButtonDisabled : null,
                  ]}
                >
                  <Icon
                    name={action.icon}
                    library={action.iconLibrary}
                    size={22}
                    tone={action.disabledReason ? 'iconDisabled' : 'primary'}
                  />
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  scrim: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  // Each entry's button is centred over the `+`.
  menu: (buttonBottom: number) => ({
    position: 'absolute',
    bottom: buttonBottom + theme.sizes.fab.md + theme.spacing.md,
    zIndex: theme.zIndex.overlay,
    right:
      theme.layout.pageGutter + (theme.sizes.fab.md - theme.sizes.fab.sm) / 2,
    alignItems: 'flex-end',
    gap: theme.spacing.md,
  }),
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  labelPill: {
    alignItems: 'flex-end',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    ...theme.shadows.md,
  },
  entryButton: {
    width: theme.sizes.fab.sm,
    height: theme.sizes.fab.sm,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  entryButtonDisabled: {
    ...theme.shadows.none,
  },
}));
