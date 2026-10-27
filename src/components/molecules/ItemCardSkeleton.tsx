import React from 'react';
import { RowCard } from '#components/atoms/RowCard';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonLine } from '#components/atoms/Skeleton/SkeletonLine';
import { SkeletonRectangle } from '#components/atoms/Skeleton/SkeletonRectangle';
import { ListItem } from '#components/molecules/ListItem';
import { type, rowType } from '#/theme/foundations/type';

// The bars stand in for the row's own text, so they take their heights from the
// roles that text uses.
const TITLE_HEIGHT = type[rowType.title].fontSize;
const SUBTITLE_HEIGHT = type[rowType.subtitle].fontSize;

interface ItemCardSkeletonProps {
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * The placeholder of an `ItemCard` with a row thumbnail. Built from the same
 * `RowCard` and `ListItem`, so it keeps the row's height, padding and gap.
 */
export const ItemCardSkeleton: React.FC<ItemCardSkeletonProps> = ({
  animated = true,
}) => {
  return (
    <RowCard>
      <ListItem>
        <SkeletonRectangle
          width={48}
          height={48}
          borderRadius={8}
          animated={animated}
        />
        <View style={styles.content}>
          <SkeletonLine width="70%" height={TITLE_HEIGHT} animated={animated} />
          <SkeletonLine
            width="50%"
            height={SUBTITLE_HEIGHT}
            animated={animated}
          />
        </View>
      </ListItem>
    </RowCard>
  );
};

const styles = StyleSheet.create(theme => ({
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.layout.rowTextGap,
  },
}));
