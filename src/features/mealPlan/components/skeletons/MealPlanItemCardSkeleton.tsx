import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonBase } from '#components/atoms/Skeleton/SkeletonBase';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';

/** Uses the same row surface and slots as MealPlanItemCard. */
export const MealPlanItemCardSkeleton: React.FC = () => (
  <View style={commonStyles.rowWrapper}>
    <View style={commonStyles.rowSurface}>
      <View style={commonStyles.rowContent}>
        <SkeletonBase width={24} height={24} borderRadius={12} />
        <SkeletonBase
          width={48}
          height={48}
          borderRadius={styles.imageBorderRadius.borderRadius}
        />
        <View style={styles.content}>
          <View style={styles.titleLine}>
            <SkeletonBase width="70%" height={16} borderRadius={4} />
          </View>
          <View style={[commonStyles.rowTextGap, styles.subtitleLine]}>
            <SkeletonBase width="50%" height={14} borderRadius={4} />
          </View>
        </View>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create(theme => ({
  imageBorderRadius: {
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  content: {
    flex: 1,
  },
  titleLine: {
    minHeight: theme.type[rowType.title].lineHeight,
    justifyContent: 'center',
  },
  subtitleLine: {
    minHeight: theme.type.caption.lineHeight,
    justifyContent: 'center',
  },
}));
