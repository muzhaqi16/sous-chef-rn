import React from 'react';
import { ViewStyle } from 'react-native';
import { SkeletonBase } from './SkeletonBase';

interface SkeletonRectangleProps {
  /** Width of the rectangle */
  width?: number | string;
  /** Height of the rectangle */
  height?: number;
  /** Border radius */
  borderRadius?: number;
  /** Additional style */
  style?: ViewStyle;
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * Skeleton Rectangle Component
 *
 * Represents a rectangular placeholder, typically used for images, cards, or blocks.
 *
 * @example
 * ```typescript
 * // Image placeholder
 * <SkeletonRectangle width={300} height={200} borderRadius={8} />
 *
 * // Card placeholder
 * <SkeletonRectangle width="100%" height={120} borderRadius={12} />
 *
 * // Thumbnail placeholder
 * <SkeletonRectangle width={60} height={60} borderRadius={4} />
 * ```
 */
export const SkeletonRectangle: React.FC<SkeletonRectangleProps> = ({
  width = '100%',
  height = 100,
  borderRadius = 8,
  style,
  animated = true,
}) => {
  return (
    <SkeletonBase
      width={width}
      height={height}
      borderRadius={borderRadius}
      style={style}
      animated={animated}
    />
  );
};
