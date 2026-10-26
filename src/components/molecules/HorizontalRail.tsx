import React from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { EdgeFade } from '#components/atoms/EdgeFade';
import { useScrollEdgeFades } from '#hooks/ui/useScrollEdgeFades';

interface HorizontalRailProps {
  children: React.ReactNode;
  /** The surface under the rail, which its edge fades blend into. */
  surface: 'background' | 'surface';
  /**
   * `page` reaches through the screen's gutter to its edges, with the first
   * tile still lined up under the content above; `none` stays in its parent.
   */
  bleed?: 'page' | 'none';
  testID?: string;
}

/** Tiles in one row that scrolls sideways, faded where more lies out of view. */
export const HorizontalRail: React.FC<HorizontalRailProps> = ({
  children,
  surface,
  bleed = 'none',
  testID,
}) => {
  styles.useVariants({ bleed });
  const { edges, onScroll, onContentSizeChange, onLayout } =
    useScrollEdgeFades();

  return (
    <View style={styles.rail}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        onLayout={onLayout}
        onContentSizeChange={onContentSizeChange}
        onScroll={onScroll}
        scrollEventThrottle={16}
        testID={testID}
      >
        {children}
      </ScrollView>
      {!!edges.left && <EdgeFade side="left" colorKey={surface} />}
      {!!edges.right && <EdgeFade side="right" colorKey={surface} />}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  rail: {
    variants: {
      bleed: {
        page: { marginHorizontal: -theme.layout.pageGutter },
        none: {},
      },
    },
  },
  // Vertical room for the tiles' shadows, which the scroller would clip.
  content: {
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    variants: {
      bleed: {
        page: { paddingHorizontal: theme.layout.pageGutter },
        none: {},
      },
    },
  },
}));
