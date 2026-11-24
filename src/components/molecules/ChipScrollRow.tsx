import { View, type StyleProp, type ViewStyle } from 'react-native';
// RNGH's ScrollView (not RN's) so the row scrolls when nested inside a
// @gorhom/bottom-sheet — RN's ScrollView doesn't coordinate with the sheet's
// gesture-handler pan and won't scroll horizontally there.
import { ScrollView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native-unistyles';
import type { IconName } from '#components/atoms/Icon';
import { Chip } from '#components/molecules/Chip';
import { EdgeFade } from '#components/atoms/EdgeFade';
import { useScrollEdgeFades } from '#hooks/ui/useScrollEdgeFades';
import { useCenterActiveItem } from '#hooks/ui/useCenterActiveItem';
import Animated from 'react-native-reanimated';

// Reanimated drives the centering scroll through `useCenterActiveItem`'s
// `animatedRef`. RNGH's ScrollView, for horizontal scrolling inside a sheet.
const AnimatedChipScrollView = Animated.createAnimatedComponent(ScrollView);

export interface ChipOption<T> {
  key: T;
  label: string;
  icon?: IconName;
  testID?: string;
}

interface ChipScrollRowProps<T> {
  options: ChipOption<T>[];
  selected: T;
  onSelect: (key: T) => void;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
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
  style,
  contentContainerStyle,
  edgeFadeColor,
}: ChipScrollRowProps<T>) {
  const { edges, metrics, onScroll, onContentSizeChange, onLayout } =
    useScrollEdgeFades(!!edgeFadeColor);

  // Keep the selected chip centered, like the pantry location filter strip.
  const { onItemLayout, animatedRef } = useCenterActiveItem({
    activeKey: selected,
    metrics,
  });

  const chips = options.map(opt => (
    <Chip
      key={String(opt.key)}
      label={opt.label}
      icon={opt.icon}
      selected={selected === opt.key}
      onPress={() => onSelect(opt.key)}
      onLayout={e => onItemLayout(opt.key, e)}
      testID={opt.testID}
    />
  ));

  // Centering reads the live widths and offset, so all three handlers always
  // run; with fades off `useScrollEdgeFades` still updates `metrics` but never
  // flips `edges`, so a fade-less row adds no re-renders.
  const scroller = (
    <AnimatedChipScrollView
      ref={animatedRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipRow, contentContainerStyle]}
      style={edgeFadeColor ? undefined : [styles.row, style]}
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
    <View style={[styles.row, style]}>
      {scroller}
      {!!edges.left && <EdgeFade side="left" colorKey={edgeFadeColor} />}
      {!!edges.right && <EdgeFade side="right" colorKey={edgeFadeColor} />}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  // As tall as its chips in a column: a horizontal ScrollView grows by default.
  row: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipRow: {
    gap: theme.spacing.sm,
  },
}));
