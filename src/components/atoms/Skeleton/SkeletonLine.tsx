import React from 'react';
import { ViewStyle } from 'react-native';
import { SkeletonBase } from './SkeletonBase';

interface SkeletonLineProps {
  width?: number | string;
  height?: number;
  style?: ViewStyle;
  animated?: boolean;
}

/** A line of text in a loading state. */
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
