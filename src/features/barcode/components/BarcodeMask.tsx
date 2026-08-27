import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Svg, { Defs, Rect, Mask } from 'react-native-svg';
import AnimatedScanLine from '#components/molecules/AnimatedScanLine';

interface BarcodeMaskProps {
  width?: number;
  height?: number;
  edgeColor?: string;
  backgroundColor?: string;
  showAnimatedLine?: boolean;
  lineAnimationDuration?: number;
}

const BarcodeMask: React.FC<BarcodeMaskProps> = ({
  width = 280,
  height = 230,
  edgeColor = '#62B1F6',
  backgroundColor = 'rgba(0, 0, 0, 0.6)',
  showAnimatedLine = true,
  lineAnimationDuration = 2000,
}) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const maskId = 'mask';
  const centerX = screenWidth / 2;
  const centerY = screenHeight / 2;
  const left = centerX - width / 2;
  const top = centerY - height / 2;

  const cornerOffset = 4;

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

      {/* Corner brackets — children of a wrapper at the cutout area so
          positioning is relative, not dependent on screen dimensions */}
      <View
        style={[
          styles.cornerContainer,
          {
            left: left - cornerOffset,
            top: top - cornerOffset,
            width: width + cornerOffset * 2,
            height: height + cornerOffset * 2,
          },
        ]}
      >
        <View
          style={[
            styles.cornerTopLeft,
            { borderLeftColor: edgeColor, borderTopColor: edgeColor },
          ]}
        />
        <View
          style={[
            styles.cornerTopRight,
            { borderRightColor: edgeColor, borderTopColor: edgeColor },
          ]}
        />
        <View
          style={[
            styles.cornerBottomLeft,
            { borderLeftColor: edgeColor, borderBottomColor: edgeColor },
          ]}
        />
        <View
          style={[
            styles.cornerBottomRight,
            { borderRightColor: edgeColor, borderBottomColor: edgeColor },
          ]}
        />
      </View>

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
  cornerContainer: {
    position: 'absolute',
  },
  cornerTopLeft: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: 'transparent',
    top: 0,
    left: 0,
  },
  cornerTopRight: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: 'transparent',
    top: 0,
    right: 0,
  },
  cornerBottomLeft: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: 'transparent',
    bottom: 0,
    left: 0,
  },
  cornerBottomRight: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
    borderColor: 'transparent',
    bottom: 0,
    right: 0,
  },
}));

export default BarcodeMask;
