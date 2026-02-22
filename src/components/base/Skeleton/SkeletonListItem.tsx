import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SkeletonCircle } from './SkeletonCircle';
import { SkeletonLine } from './SkeletonLine';
import { SkeletonRectangle } from './SkeletonRectangle';

interface SkeletonListItemProps {
  /** Whether to show a leading element (avatar or image) */
  showLeading?: boolean;
  /** Type of leading element */
  leadingType?: 'circle' | 'rectangle';
  /** Size of the leading element */
  leadingSize?: number;
  /** Whether to show a subtitle */
  showSubtitle?: boolean;
  /** Whether to show a trailing element */
  showTrailing?: boolean;
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * Skeleton List Item Component
 *
 * Represents a list item placeholder with optional avatar, title, subtitle, and trailing element.
 * This is a composed component built from the base skeleton primitives.
 *
 * @example
 * ```typescript
 * // List item with avatar
 * <SkeletonListItem showLeading leadingType="circle" showSubtitle />
 *
 * // List item with image thumbnail
 * <SkeletonListItem showLeading leadingType="rectangle" leadingSize={60} />
 *
 * // Simple list item (title only)
 * <SkeletonListItem />
 * ```
 */
export const SkeletonListItem: React.FC<SkeletonListItemProps> = ({
  showLeading = true,
  leadingType = 'circle',
  leadingSize = 40,
  showSubtitle = true,
  showTrailing = false,
  animated = true,
}) => {
  const styles = StyleSheet.create(theme => ({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.surface,
    },
    leading: {
      marginRight: theme.spacing.sm,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      marginBottom: showSubtitle ? theme.spacing.xs : 0,
    },
    trailing: {
      marginLeft: theme.spacing.sm,
    },
  }));

  return (
    <View style={styles.container}>
      {/* Leading element (avatar or thumbnail) */}
      {!!showLeading && (
        <View style={styles.leading}>
          {leadingType === 'circle' ? (
            <SkeletonCircle size={leadingSize} animated={animated} />
          ) : (
            <SkeletonRectangle
              width={leadingSize}
              height={leadingSize}
              borderRadius={8}
              animated={animated}
            />
          )}
        </View>
      )}

      {/* Content (title and optional subtitle) */}
      <View style={styles.content}>
        {/* Title */}
        <SkeletonLine
          width="70%"
          height={16}
          style={styles.title}
          animated={animated}
        />
        {/* Subtitle */}
        {!!showSubtitle && <SkeletonLine width="50%" height={14} animated={animated} />}
      </View>

      {/* Trailing element */}
      {!!showTrailing && (
        <View style={styles.trailing}>
          <SkeletonCircle size={24} animated={animated} />
        </View>
      )}
    </View>
  );
};
