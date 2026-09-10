import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonCircle } from '#components/atoms/Skeleton/SkeletonCircle';
import { SkeletonLine } from '#components/atoms/Skeleton/SkeletonLine';
import { SkeletonRectangle } from '#components/atoms/Skeleton/SkeletonRectangle';
import { ListItem } from '#components/molecules/ListItem';
import { commonStyles } from '#/styles/commonStyles';
import { type, rowType } from '#/theme/foundations/type';

// The bars stand in for the row's own text, so they take their heights from the
// roles that text uses.
const TITLE_HEIGHT = type[rowType.title].fontSize;
const SUBTITLE_HEIGHT = type[rowType.subtitle].fontSize;

interface ShoppingListItemSkeletonProps {
  animated?: boolean;
}

/** Wraps ListItem so the skeleton stays in sync with the real item's styles. */
export const ShoppingListItemSkeleton: React.FC<
  ShoppingListItemSkeletonProps
> = ({ animated = true }) => {
  return (
    <View style={commonStyles.rowWrapper}>
      <ListItem>
        <SkeletonCircle size={24} animated={animated} />
        <SkeletonRectangle
          width={44}
          height={44}
          borderRadius={8}
          animated={animated}
        />
        <View style={styles.content}>
          <SkeletonLine width="70%" height={TITLE_HEIGHT} animated={animated} />
          <SkeletonLine
            width="40%"
            height={SUBTITLE_HEIGHT}
            style={commonStyles.rowTextGap}
            animated={animated}
          />
        </View>
        <SkeletonLine width={40} height={30} animated={animated} />
      </ListItem>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
  },
});
