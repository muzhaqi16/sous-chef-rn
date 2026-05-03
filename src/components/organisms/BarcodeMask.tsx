import React from 'react';
import { View, Dimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Svg, { Defs, Rect, Mask } from 'react-native-svg';
import AnimatedScanLine from '../molecules/AnimatedScanLine';

interface BarcodeMaskProps {
  width?: number;
  height?: number;
  edgeColor?: string;
  backgroundColor?: string;
  showAnimatedLine?: boolean;
  lineAnimationDuration?: number;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

  const cornerOffset = 4; // Consistent offset for corners
  const cornerSize = 40; // Larger corner size for better visibility

  return (
    <View style={styles.container}>
      {/* SVG Overlay with cutout */}
      <Svg width={screenWidth} height={screenHeight} style={styles.svgOverlay}>
        <Defs>
          <Mask id={maskId}>
            <Rect width="100%" height="100%" fill="white" />
            <Rect
              transform={`translate(${left}, ${top})`}
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

      {/* Corner brackets - properly aligned */}
      {/* Left */}
      <View
        style={[
          styles.corner,
          {
            left: left - cornerOffset,
            top: top - cornerOffset,
            borderLeftColor: edgeColor,
            borderTopColor: edgeColor,
          },
        ]}
      />
      <View
        style={[
          styles.corner,
          {
            right: screenWidth - left - width - cornerOffset,
            top: top - cornerOffset,
            borderRightColor: edgeColor,
            borderTopColor: edgeColor,
          },
        ]}
      />
      {/* Bottom Left */}
      <View
        style={[
          styles.corner,
          {
            left: left - cornerOffset,
            bottom: screenHeight - top - height - cornerOffset - cornerSize,
            borderLeftColor: edgeColor,
            borderBottomColor: edgeColor,
          },
        ]}
      />
      {/* Bottom Right */}
      <View
        style={[
          styles.corner,
          {
            right: screenWidth - left - width - cornerOffset,
            bottom: screenHeight - top - height - cornerOffset - cornerSize,
            borderRightColor: edgeColor,
            borderBottomColor: edgeColor,
          },
        ]}
      />

      {/* Animated scanning line */}
      {!!showAnimatedLine && (
        <AnimatedScanLine
          left={left}
          top={top}
          width={width}
          height={height}
          color={edgeColor}
          duration={lineAnimationDuration}
          cornerOffset={cornerOffset}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  container: {
    ...StyleSheet.absoluteFill,
  },
  svgOverlay: {
    ...StyleSheet.absoluteFill,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: 'transparent',
  },
}));

export default BarcodeMask;
