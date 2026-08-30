import React from 'react';
import { ViewStyle } from 'react-native';
import { SkeletonBase } from './SkeletonBase';

interface SkeletonRectangleProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  animated?: boolean;
}

/** Rectangular placeholder for images, cards, or blocks. */
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
