import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, { FadeOut } from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';

interface DeferredScreenProps {
  fallback: React.ReactNode;
  component: React.ComponentType;
}

/**
 * Shows `fallback` instantly and mounts `component` only once
 * `useDeferredRender()` is true, so heavy hooks structurally cannot run before
 * the skeleton paints. The skeleton overlays absolutely and leaves via
 * `exiting={FadeOut}`, making the swap a crossfade rather than a hard cut.
 */
export function DeferredScreen({
  fallback,
  component: Component,
}: DeferredScreenProps) {
  const isReady = useDeferredRender();

  return (
    <View style={styles.fill}>
      {isReady ? <Component /> : null}
      {isReady ? null : (
        <Animated.View
          exiting={FadeOut.duration(TIMING.STANDARD)}
          style={styles.overlay}
          pointerEvents="none"
        >
          {fallback}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create(theme => ({
  fill: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
}));
