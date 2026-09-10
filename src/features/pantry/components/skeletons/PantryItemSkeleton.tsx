import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { radii } from '#/theme/foundations/radii';
import { sizes } from '#/theme/foundations/sizes';
import { type, rowType } from '#/theme/foundations/type';
import { commonStyles } from '#/styles/commonStyles';
import { SkeletonLine } from '#components/atoms/Skeleton/SkeletonLine';
import { SkeletonRectangle } from '#components/atoms/Skeleton/SkeletonRectangle';

// Mode-invariant foundations (`commonTheme`), so reading them at module scope
// saves this skeleton a `useUnistyles()` subscription.
const IMAGE_SIZE = sizes.itemCard.compact.image;
const IMAGE_RADIUS = radii.md;
// The bars stand in for the row's own text, so they take their heights from the
// roles that text uses.
const TITLE_HEIGHT = type[rowType.title].fontSize;
const SUBTITLE_HEIGHT = type[rowType.subtitle].fontSize;

interface PantryItemSkeletonProps {
  animated?: boolean;
}

/** Mirrors `PantryItemCard`'s layout, so rows don't shift on reveal. */
export const PantryItemSkeleton: React.FC<PantryItemSkeletonProps> = ({
  animated = true,
}) => {
  return (
    <View style={commonStyles.rowWrapper}>
      <View style={[commonStyles.rowSurface, commonStyles.rowContent]}>
        <SkeletonRectangle
          width={IMAGE_SIZE}
          height={IMAGE_SIZE}
          borderRadius={IMAGE_RADIUS}
          animated={animated}
        />

        {/* Title + subtitle — matches CardContent */}
        <View style={styles.content}>
          <SkeletonLine width="70%" height={TITLE_HEIGHT} animated={animated} />
          <SkeletonLine
            width="50%"
            height={SUBTITLE_HEIGHT}
            style={commonStyles.rowTextGap}
            animated={animated}
          />
        </View>

        {/* Quantity + detail — matches CardRightSlot's meta type */}
        <View style={styles.trailing}>
          <SkeletonLine width={45} height={TITLE_HEIGHT} animated={animated} />
          <SkeletonLine
            width={40}
            height={SUBTITLE_HEIGHT}
            style={commonStyles.rowTextGap}
            animated={animated}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  trailing: {
    alignItems: 'flex-end',
  },
});
