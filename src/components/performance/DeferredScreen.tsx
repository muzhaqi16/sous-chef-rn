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
 * Wraps a heavy screen component with deferred rendering.
 *
 * Shows `fallback` (skeleton) instantly; mounts `component` only after
 * `useDeferredRender()` returns true — structurally preventing heavy hooks
 * from running before the skeleton paints.
 *
 * The skeleton sits in an absolute overlay and leaves via Reanimated's
 * `exiting={FadeOut}` once the real component is mounted underneath, so the
 * skeleton→content swap is a crossfade rather than a hard cut. The real
 * component is still gated behind `isReady`, so deferral semantics are
 * unchanged — only the visual transition is softened.
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
