import React from 'react';
import { ViewStyle } from 'react-native';
import { SkeletonBase } from './SkeletonBase';

interface SkeletonCircleProps {
  /** Diameter. */
  size?: number;
  style?: ViewStyle;
  animated?: boolean;
}

export const SkeletonCircle: React.FC<SkeletonCircleProps> = ({
  size = 40,
  style,
  animated = true,
}) => {
  return (
    <SkeletonBase
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
      animated={animated}
    />
  );
};
