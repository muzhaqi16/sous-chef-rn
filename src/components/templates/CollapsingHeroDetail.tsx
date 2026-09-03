import React from 'react';
import {
  View,
  RefreshControl,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '#/i18n';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';
import { OfflineStatusPill } from '#components/atoms/OfflineStatusPill';
import {
  HeaderActionIcon,
  type HeaderAction,
} from '#components/atoms/HeaderActionIcon';

// Visible hero height below the status bar; `heroHeight` grows it by the top
// inset so it fills edge-to-edge behind it.
export const HERO_IMAGE_HEIGHT = 280;

const HEADER_TOP_GAP = 8;
const BUTTON_SIZE = 40;
// Action-button band below the status-bar inset; also reserved above the title
// when there is no hero.
export const HEADER_BAND_HEIGHT = HEADER_TOP_GAP + BUTTON_SIZE + HEADER_TOP_GAP;

const COLLAPSE_DISTANCE = HERO_IMAGE_HEIGHT - HEADER_BAND_HEIGHT;
// The scroll offset at which the content card's top reaches the bar. The bar
// turns opaque just before it, so content arrives to scroll beneath an already
// solid bar. Exported so hero renderers can keep interactive elements clear.
export const CONTENT_OVERLAP = 20;
const COLLAPSE_POINT = COLLAPSE_DISTANCE - CONTENT_OVERLAP;
const BAR_FADE_END = COLLAPSE_POINT;
const BAR_FADE_START = COLLAPSE_POINT - 24;

// The inline bar title must not appear until the in-content `DetailTitleRow` has
// scrolled fully under the opaque bar, or both show at once. The clearing
// distance is inset-independent: the title's line box plus the card/row top
// paddings, measured from where the variant places it.
const TITLE_FADE_START = COLLAPSE_POINT + 12;
const TITLE_FADE_END = COLLAPSE_POINT + 48;

// Same rule for no-hero screens, whose bar is already solid: the large title
// clears after roughly its line box plus the card/row top paddings.
const NO_HERO_TITLE_FADE_START = 48;
const NO_HERO_TITLE_FADE_END = 72;

const CIRCLE_SHADOW = [
  {
    offsetX: 0,
    offsetY: 1,
    blurRadius: 2.22,
    spreadDistance: 0,
    color: 'rgba(0, 0, 0, 0.22)',
  },
];

/** Circular icon button, legible floating over a photo. Its color/loading/disabled
 *  rules come from `HeaderActionIcon`, shared with the `Header` bars. */
const HeroChip: React.FC<{ action: HeaderAction }> = ({ action }) => (
  <AppPressable
    onPress={action.onPress}
    disabled={action.disabled || action.loading}
    style={styles.chip}
    hitSlop={8}
    testID={action.testID}
    accessibilityRole="button"
    accessibilityLabel={action.accessibilityLabel}
  >
    <HeaderActionIcon action={action} defaultSize={22} />
  </AppPressable>
);

interface CollapsingHeroDetailProps {
  onBack: () => void;
  actions?: HeaderAction[];
  /** Hidden at rest; fades in as the hero collapses, or as the large title
   *  scrolls under the bar on a no-hero screen. */
  title?: string;
  /**
   * Renders the hero at the given height, already grown by the top inset. Omit for
   * a no-hero screen, whose bar is then solid from the start.
   */
  renderHero?: (heroHeight: number) => React.ReactNode;
  /** Recede the hero at half scroll speed and zoom on pull-down. */
  parallax?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
}

// Edge-to-edge hero collapsing into a pinned action bar, with the content riding
// up over it in a rounded card. With no hero the bar is solid from the start.
//
// The screen must NOT apply a top safe-area inset (omit `topInsetScreenLayout` in
// its stack registration) — this layout draws behind the status bar and insets
// itself.
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hasHero = !!renderHero;
  const heroHeight = HERO_IMAGE_HEIGHT + insets.top;

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.set(event.contentOffset.y);
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

  // Transparent over the hero, opaque exactly as the content card reaches the
  // bar. Image-less screens are solid from the start.
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
    if (!title) return { opacity: 0 };
    if (!hasHero) {
      return {
        opacity: interpolate(
          scrollY.get(),
          [NO_HERO_TITLE_FADE_START, NO_HERO_TITLE_FADE_END],
          [0, 1],
          Extrapolation.CLAMP,
        ),
      };
    }
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

      <View
        pointerEvents="box-none"
        style={[styles.bar, { height: insets.top + HEADER_BAND_HEIGHT }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.barSolid, barBgStyle]}
        />
        <View style={[styles.barRow, { top: insets.top + HEADER_TOP_GAP }]}>
          <HeroChip
            action={{
              icon: 'arrow-back',
              onPress: onBack,
              tone: 'textPrimary',
              accessibilityLabel: t('labels.goBack'),
            }}
          />
          {/* Always mounted; the interpolated opacity (and pointerEvents
              "none") keeps it invisible and inert while the hero is
              expanded, with no UI↔JS mount round-trips during scroll. */}
          <Animated.View
            pointerEvents="none"
            style={[styles.titleWrap, titleStyle]}
          >
            {title ? (
              <Text size="md" weight="semibold" numberOfLines={1}>
                {title}
              </Text>
            ) : null}
          </Animated.View>
          <View style={styles.actionsRow}>
            {/* Leads the chips so a pushed detail screen carries the offline
                signal too, not just the tab headers. Renders null when online,
                leaving the chip row untouched. */}
            <OfflineStatusPill size={22} />
            {actions.map((action, index) => (
              <HeroChip
                key={action.testID ?? `${action.icon}-${index}`}
                action={action}
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
    marginTop: -theme.spacing.mdPlus,
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
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  barRow: {
    position: 'absolute',
    left: theme.spacing.base,
    right: theme.spacing.base,
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
}));
