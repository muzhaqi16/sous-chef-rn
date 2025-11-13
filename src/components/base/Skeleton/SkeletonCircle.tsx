import React from 'react';
import { ViewStyle } from 'react-native';
import { SkeletonBase } from './SkeletonBase';

interface SkeletonCircleProps {
  /** Size (diameter) of the circle */
  size?: number;
  /** Additional style */
  style?: ViewStyle;
  /** Whether to show shimmer animation */
  animated?: boolean;
}

/**
 * Skeleton Circle Component
 *
 * Represents a circular placeholder, typically used for avatars or icons.
 *
 * @example
 * ```typescript
 * // Avatar placeholder
 * <SkeletonCircle size={40} />
 *
 * // Large profile picture placeholder
 * <SkeletonCircle size={100} />
 *
 * // Small icon placeholder
 * <SkeletonCircle size={24} />
 * ```
 */
export const SkeletonCircle: React.FC<SkeletonCircleProps> = ({
  size = 40,
  style,
  animated = true,
}) => {
  return (
    <SkeletonBase
      width={size}
      height={size}
      borderRadius={size / 2} // Make it circular
      style={style}
      animated={animated}
    />
  );
};
