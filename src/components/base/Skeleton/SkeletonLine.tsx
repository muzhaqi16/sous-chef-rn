import React from 'react';
import { ViewStyle } from 'react-native';
import { SkeletonBase } from './SkeletonBase';

interface SkeletonLineProps {
  /** Width of the line (number or percentage string) */
  width?: number | string;
  /** Height of the line (defaults to typography-appropriate height) */
  height?: number;
  /** Additional style */
  style?: ViewStyle;
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * Skeleton Line Component
 *
 * Represents a line of text in loading state.
 * Useful for title, subtitle, or paragraph placeholders.
 *
 * @example
 * ```typescript
 * // Title placeholder
 * <SkeletonLine width="70%" height={24} />
 *
 * // Subtitle placeholder
 * <SkeletonLine width="50%" height={16} />
 *
 * // Full width paragraph
 * <SkeletonLine width="100%" />
 * ```
 */
export const SkeletonLine: React.FC<SkeletonLineProps> = ({
  width = '100%',
  height = 16,
  style,
  animated = true,
}) => {
  return (
    <SkeletonBase
      width={width}
      height={height}
      borderRadius={4}
      style={style}
      animated={animated}
    />
  );
};
