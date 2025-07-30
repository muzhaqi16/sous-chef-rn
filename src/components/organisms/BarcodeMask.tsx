import React from 'react';
import {View, StyleSheet, Dimensions} from 'react-native';
import Svg, {Defs, Rect, Mask} from 'react-native-svg';
import AnimatedScanLine from '../molecules/AnimatedScanLine';

interface BarcodeMaskProps {
  width?: number;
  height?: number;
  edgeColor?: string;
  backgroundColor?: string;
  showAnimatedLine?: boolean;
  lineAnimationDuration?: number;
}

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

const BarcodeMask: React.FC<BarcodeMaskProps> = ({
  width = 280,
  height = 230,
  edgeColor = '#62B1F6',
  backgroundColor = 'rgba(0, 0, 0, 0.6)',
  showAnimatedLine = true,
  lineAnimationDuration = 2000,
}) => {
  const maskId = 'mask';
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  const left = centerX - width / 2;
  const top = centerY - height / 2;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* SVG Overlay with cutout */}
      <Svg
        width={screenWidth}
        height={screenHeight}
        style={StyleSheet.absoluteFillObject}>
        <Defs>
          <Mask id={maskId}>
            <Rect width="100%" height="100%" fill="white" />
            <Rect
              x={left}
              y={top}
              width={width}
              height={height}
              rx={8}
              ry={8}
              fill="black"
            />
          </Mask>
        </Defs>
        <Rect
          width="100%"
          height="100%"
          fill={backgroundColor}
          mask={`url(#${maskId})`}
        />
      </Svg>

      {/* Corner brackets */}
      <View
        style={[
          styles.corner,
          {
            left: left - 2,
            top: top - 2,
            borderLeftColor: edgeColor,
            borderTopColor: edgeColor,
          },
        ]}
      />
      <View
        style={[
          styles.corner,
          {
            right: screenWidth - left - width - 2,
            top: top - 2,
            borderRightColor: edgeColor,
            borderTopColor: edgeColor,
          },
        ]}
      />
      <View
        style={[
          styles.corner,
          {
            left: left - 2,
            bottom: screenHeight - top - height - 2,
            borderLeftColor: edgeColor,
            borderBottomColor: edgeColor,
          },
        ]}
      />
      <View
        style={[
          styles.corner,
          {
            right: screenWidth - left - width - 2,
            bottom: screenHeight - top - height - 2,
            borderRightColor: edgeColor,
            borderBottomColor: edgeColor,
          },
        ]}
      />

      {/* Animated scanning line */}
      {showAnimatedLine && (
        <AnimatedScanLine
          left={left}
          top={top}
          width={width}
          height={height}
          color={edgeColor}
          duration={lineAnimationDuration}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
    borderColor: 'transparent',
  },
});

export default BarcodeMask;
