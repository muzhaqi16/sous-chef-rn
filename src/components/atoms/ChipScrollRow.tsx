import { View, type StyleProp, type ViewStyle } from 'react-native';
// RNGH's ScrollView (not RN's) so the row scrolls when nested inside a
// @gorhom/bottom-sheet — RN's ScrollView doesn't coordinate with the sheet's
// gesture-handler pan and won't scroll horizontally there.
import { ScrollView } from 'react-native-gesture-handler';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { Icon, type IconName } from '#utils/iconUtils';
import { EdgeFade } from '#components/atoms/EdgeFade';
import { useScrollEdgeFades } from '#hooks/ui/useScrollEdgeFades';
import { useCenterActiveItem } from '#hooks/ui/useCenterActiveItem';
import Animated from 'react-native-reanimated';

// Animated wrapper so Reanimated can drive the centering scroll on the UI
// thread via the `animatedRef` from `useCenterActiveItem`. Built once at module
// scope — `createAnimatedComponent` must never run per render. Wraps RNGH's
// ScrollView (kept for horizontal scrolling inside a bottom sheet).
const AnimatedChipScrollView = Animated.createAnimatedComponent(ScrollView);

export interface ChipOption<T> {
  key: T;
  label: string;
  icon?: IconName;
}

interface ChipScrollRowProps<T> {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Per-chip style override — e.g. a fixed height to match form inputs. */
  chipStyle?: StyleProp<ViewStyle>;
  /**
   * Enables soft edge fades that signal more chips can be scrolled into view.
   * The value names the surface the row sits on so the fade blends into it:
   * `background` for a screen, `surface` for a bottom sheet. Omit to disable.
   */
  edgeFadeColor?: 'background' | 'surface';
}

export function ChipScrollRow<T>({
  options,
  selected,
  onSelect,
  size = 'sm',
  style,
  contentContainerStyle,
  chipStyle,
  edgeFadeColor,
}: ChipScrollRowProps<T>) {
  styles.useVariants({ size });

  const { edges, metrics, onScroll, onContentSizeChange, onLayout } =
    useScrollEdgeFades(!!edgeFadeColor);

  // Keep the selected chip centered, like the pantry location filter strip.
  const { onItemLayout, animatedRef } = useCenterActiveItem({
    activeKey: selected,
    metrics,
  });

  const chips = options.map(opt => {
    const isActive = selected === opt.key;
    return (
      <Pressable
        key={opt.label}
        onPress={() => onSelect(opt.key)}
        onLayout={e => onItemLayout(opt.key, e)}
      >
        <View style={[styles.chip, isActive && styles.chipActive, chipStyle]}>
          {opt.icon ? (
            <Icon
              name={opt.icon}
              size={size === 'md' ? 18 : 16}
              tone={isActive ? 'primary' : 'textSecondary'}
            />
          ) : null}
          <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
            {opt.label}
          </Text>
        </View>
      </Pressable>
    );
  });

  // Centering needs the live viewport/content widths and scroll position, so
  // all three handlers run always. `useScrollEdgeFades(!!edgeFadeColor)` keeps
  // updating `metrics` but only flips the fade `edges` when fades are enabled,
  // so a fade-less row tracks scroll for centering without extra re-renders.
  const scroller = (
    <AnimatedChipScrollView
      ref={animatedRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipRow, contentContainerStyle]}
      style={edgeFadeColor ? undefined : style}
      onLayout={onLayout}
      onContentSizeChange={onContentSizeChange}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      {chips}
    </AnimatedChipScrollView>
  );

  // Without fades, return the bare scroller (unchanged behavior). With them,
  // wrap so the absolutely-positioned fades anchor to the row's bounds.
  if (!edgeFadeColor) return scroller;

  return (
    <View style={style}>
      {scroller}
      {!!edges.left && <EdgeFade side="left" colorKey={edgeFadeColor} />}
      {!!edges.right && <EdgeFade side="right" colorKey={edgeFadeColor} />}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  chipRow: {
    gap: theme.spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    variants: {
      size: {
        sm: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
        },
        md: {
          paddingHorizontal: theme.spacing['5'],
          paddingVertical: theme.spacing.sm,
        },
      },
    },
  },
  chipActive: {
    borderColor: theme.colors.primary,
  },
  chipText: {
    color: theme.colors.textSecondary,
    includeFontPadding: false,
    textAlignVertical: 'center',
    variants: {
      size: {
        sm: {
          fontSize: theme.fonts.size.sm,
        },
        md: {
          fontSize: theme.fonts.size.md,
        },
      },
    },
  },
  chipTextActive: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
}));
