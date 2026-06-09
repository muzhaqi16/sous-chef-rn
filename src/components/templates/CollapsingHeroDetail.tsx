import React, { useState } from 'react';
import {
  View,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { Icon, type IconName, type IconTone } from '#utils/iconUtils';
import type { ActionVariant, HeaderAction } from '#components/molecules/Header';

// Visible hero height below the status bar. The rendered hero is grown by the
// top inset (see `heroHeight`) so it fills edge-to-edge behind the status bar.
export const HERO_IMAGE_HEIGHT = 280;

const HEADER_TOP_GAP = 8;
const BUTTON_SIZE = 40;
// Action-button band height below the status-bar inset (gap + button + gap).
// Reserved above the title when there's no hero, and used to size the bar.
export const HEADER_BAND_HEIGHT = HEADER_TOP_GAP + BUTTON_SIZE + HEADER_TOP_GAP;

const COLLAPSE_DISTANCE = HERO_IMAGE_HEIGHT - HEADER_BAND_HEIGHT;
// The content card overlaps the hero by `theme.spacing['5']` (its negative
// marginTop), so its top reaches the bar at this scroll offset. The photo stays
// un-dimmed until then; the solid bar + inline title fade in over a short window
// just before it, so the bar is opaque exactly as content arrives to scroll
// beneath it (no overlap), tinting only a small top strip briefly.
const CONTENT_OVERLAP = 20;
const COLLAPSE_POINT = COLLAPSE_DISTANCE - CONTENT_OVERLAP;
const BAR_FADE_END = COLLAPSE_POINT;
const BAR_FADE_START = COLLAPSE_POINT - 24;
const TITLE_FADE_START = BAR_FADE_START;
const TITLE_FADE_END = BAR_FADE_END;
// Hysteresis bounds for mounting the inline title (mount on the way in, unmount
// a bit earlier on the way out) so it's never in the tree alongside the
// content's own title while the hero is expanded.
const TITLE_MOUNT_AT = BAR_FADE_START;
const TITLE_UNMOUNT_AT = BAR_FADE_START - 20;

const TONE_BY_VARIANT: Record<ActionVariant, IconTone> = {
  default: 'textPrimary',
  primary: 'primary',
  secondary: 'textSecondary',
  success: 'success',
  error: 'error',
  warning: 'warning',
};

const CIRCLE_SHADOW = [
  {
    offsetX: 0,
    offsetY: 1,
    blurRadius: 2.22,
    spreadDistance: 0,
    color: 'rgba(0, 0, 0, 0.22)',
  },
];

interface HeroChipProps {
  icon: IconName;
  onPress: () => void;
  tone?: IconTone;
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

/** Circular icon button that stays legible floating over a photo. */
const HeroChip: React.FC<HeroChipProps> = ({
  icon,
  onPress,
  tone,
  color,
  loading,
  disabled,
  testID,
  accessibilityLabel,
}) => (
  <AppPressable
    onPress={onPress}
    disabled={disabled || loading}
    style={styles.chip}
    hitSlop={8}
    testID={testID}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
  >
    {loading ? (
      <ThemedActivityIndicator size="small" />
    ) : (
      <Icon name={icon} size={22} color={color} tone={tone} />
    )}
  </AppPressable>
);

interface CollapsingHeroDetailProps {
  /** Back handler — rendered as the leading circular chip. */
  onBack: () => void;
  /** Trailing action chips. */
  actions?: HeaderAction[];
  /** Inline bar title. Fades in as the hero collapses (or shows immediately
   *  when there's no hero). */
  title?: string;
  /**
   * Renders the hero image at the given height (already grown by the top inset
   * so it draws edge-to-edge behind the status bar). Omit for a screen with no
   * hero — the bar is then solid from the start, like a normal header.
   */
  renderHero?: (heroHeight: number) => React.ReactNode;
  /** Recede the hero at half scroll speed and zoom on pull-down. */
  parallax?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra style merged into the content card (e.g. horizontal padding). */
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
}

/**
 * Immersive detail layout: an edge-to-edge hero image that collapses into a
 * pinned action bar as the user scrolls, with the content riding up over it in
 * a rounded card.
 *
 * Behavior (standard collapsing-toolbar pattern):
 * - Back + actions are circular chips, pinned, legible over the photo at rest.
 * - On scroll the whole image dims to the app background (uniform scrim) while a
 *   solid bar + optional inline title fade in, so content scrolls beneath an
 *   opaque bar instead of under floating icons.
 * - With no hero, the bar is solid from the start and space is reserved for it.
 *
 * The screen must NOT apply a top safe-area inset (omit `topInsetScreenLayout`
 * in its stack registration) — this layout draws behind the status bar and
 * insets itself.
 */
export const CollapsingHeroDetail: React.FC<CollapsingHeroDetailProps> = ({
  onBack,
  actions = [],
  title,
  renderHero,
  parallax = false,
  refreshing,
  onRefresh,
  contentStyle,
  children,
  testID,
}) => {
  const insets = useSafeAreaInsets();
  const hasHero = !!renderHero;
  const heroHeight = HERO_IMAGE_HEIGHT + insets.top;

  const scrollY = useSharedValue(0);
  // The inline bar title is mounted only once the hero has mostly collapsed, so
  // it's never duplicated with the content's own title while expanded.
  const titleFlag = useSharedValue(false);
  const [titleMounted, setTitleMounted] = useState(false);
  const showTitle = () => setTitleMounted(true);
  const hideTitle = () => setTitleMounted(false);
  const scrollHandler = useAnimatedScrollHandler(event => {
    const y = event.contentOffset.y;
    scrollY.set(y);
    if (!hasHero) return;
    if (y > TITLE_MOUNT_AT && !titleFlag.get()) {
      titleFlag.set(true);
      scheduleOnRN(showTitle);
    } else if (y < TITLE_UNMOUNT_AT && titleFlag.get()) {
      titleFlag.set(false);
      scheduleOnRN(hideTitle);
    }
  });

  const heroParallaxStyle = useAnimatedStyle(() => {
    const y = scrollY.get();
    if (y < 0) {
      return {
        transform: [{ translateY: y }, { scale: 1 + -y / HERO_IMAGE_HEIGHT }],
      };
    }
    return { transform: [{ translateY: y * 0.5 }] };
  });

  // Solid bar background: transparent over the prominent hero, fading to opaque
  // right as the content card reaches the bar so content scrolls beneath it.
  // Image-less screens are solid from the start.
  const barBgStyle = useAnimatedStyle(() => {
    if (!hasHero) return { opacity: 1 };
    return {
      opacity: interpolate(
        scrollY.get(),
        [BAR_FADE_START, BAR_FADE_END],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const titleStyle = useAnimatedStyle(() => {
    if (!hasHero) return { opacity: title ? 1 : 0 };
    return {
      opacity: interpolate(
        scrollY.get(),
        [TITLE_FADE_START, TITLE_FADE_END],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <View style={styles.container} testID={testID}>
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
            />
          ) : undefined
        }
      >
        {hasHero ? (
          <Animated.View style={parallax ? heroParallaxStyle : undefined}>
            {renderHero(heroHeight)}
          </Animated.View>
        ) : (
          <View style={{ height: insets.top + HEADER_BAND_HEIGHT }} />
        )}

        <View
          style={[
            styles.contentCard,
            !hasHero && styles.contentCardNoHero,
            contentStyle,
          ]}
        >
          {children}
        </View>
      </Animated.ScrollView>

      {/* Pinned action bar */}
      <View
        pointerEvents="box-none"
        style={[styles.bar, { height: insets.top + HEADER_BAND_HEIGHT }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.barSolid, barBgStyle]}
        />
        <View style={[styles.barRow, { top: insets.top + HEADER_TOP_GAP }]}>
          <HeroChip icon="arrow-back" onPress={onBack} tone="textPrimary" />
          <Animated.View
            pointerEvents="none"
            style={[styles.titleWrap, titleStyle]}
          >
            {(!hasHero || titleMounted) && title ? (
              <Text size="md" weight="semibold" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </Animated.View>
          <View style={styles.actionsRow}>
            {actions.map((action, index) => (
              <HeroChip
                key={action.testID ?? `${action.icon}-${index}`}
                icon={action.icon}
                onPress={action.onPress}
                color={action.color}
                tone={
                  action.tone ?? TONE_BY_VARIANT[action.variant ?? 'default']
                }
                loading={action.loading}
                disabled={action.disabled}
                testID={action.testID}
                accessibilityLabel={action.accessibilityLabel}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Opaque card that rides up over the hero as you scroll; rounded top + slight
  // overlap make the image-to-content transition.
  contentCard: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    marginTop: -theme.spacing['5'],
    paddingTop: theme.spacing.sm,
  },
  contentCardNoHero: {
    marginTop: 0,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: theme.zIndex.sticky,
  },
  barSolid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  barRow: {
    position: 'absolute',
    left: theme.spacing['3'],
    right: theme.spacing['3'],
    height: BUTTON_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  chip: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    boxShadow: CIRCLE_SHADOW,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
