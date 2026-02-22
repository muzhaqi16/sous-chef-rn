import React, { createContext, useContext, useCallback, useMemo, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet } from 'react-native-unistyles';

interface ShowBackdropOptions {
  opacity?: number;
  onPress?: () => void;
}

interface OverlayBackdropContextType {
  showBackdrop: (options?: ShowBackdropOptions) => void;
  hideBackdrop: () => void;
}

const OverlayBackdropContext = createContext<OverlayBackdropContextType | null>(null);

export const useOverlayBackdrop = (): OverlayBackdropContextType => {
  const context = useContext(OverlayBackdropContext);
  if (!context) {
    throw new Error('useOverlayBackdrop must be used within OverlayBackdropProvider');
  }
  return context;
};

interface OverlayBackdropProviderProps {
  children: React.ReactNode;
}

/**
 * Context provider for the global overlay backdrop.
 * This only provides the context - the actual backdrop is rendered by GlobalBackdrop.
 */
export const OverlayBackdropProvider: React.FC<OverlayBackdropProviderProps> = ({
  children,
}) => {
  // Use shared values only for animation-related values
  const opacity = useSharedValue(0);

  // Use regular React state/refs for non-animation values
  const [isVisible, setIsVisible] = useState(false);
  const onPressCallbackRef = useRef<(() => void) | null>(null);
  const activeCountRef = useRef(0);

  const showBackdrop = useCallback((options?: ShowBackdropOptions) => {
    activeCountRef.current += 1;
    const targetOpacity = options?.opacity ?? 0.5;
    onPressCallbackRef.current = options?.onPress ?? null;
    setIsVisible(true);
    opacity.set(withTiming(targetOpacity, { duration: 100 }));
  }, [opacity]);

  const hideBackdrop = useCallback(() => {
    activeCountRef.current = Math.max(0, activeCountRef.current - 1);
    if (activeCountRef.current === 0) {
      onPressCallbackRef.current = null;
      opacity.set(withTiming(0, { duration: 100 }, (finished) => {
        if (finished) {
          scheduleOnRN(setIsVisible, false);
        }
      }));
    }
  }, [opacity]);

  const contextValue = useMemo(
    () => ({
      showBackdrop,
      hideBackdrop,
      // Internal: expose state for GlobalBackdrop component
      _internal: {
        opacity,
        isVisible,
        onPressCallbackRef,
      },
    }),
    [showBackdrop, hideBackdrop, opacity, isVisible],
  );

  return (
    <OverlayBackdropContext.Provider value={contextValue as OverlayBackdropContextType}>
      {children}
    </OverlayBackdropContext.Provider>
  );
};

// Internal context type with private state
interface OverlayBackdropInternalContextType extends OverlayBackdropContextType {
  _internal: {
    opacity: SharedValue<number>;
    isVisible: boolean;
    onPressCallbackRef: React.RefObject<(() => void) | null>;
  };
}

/**
 * Global backdrop component that should be rendered inside BottomSheetModalProvider.
 * This allows the backdrop to be in the same stacking context as bottom sheet modals,
 * ensuring modals render on top of the backdrop.
 */
export const GlobalBackdrop: React.FC = () => {
  const context = useContext(OverlayBackdropContext) as OverlayBackdropInternalContextType | null;

  // Get values from context (may be undefined if no provider)
  const opacity = context?._internal?.opacity;
  const isVisible = context?._internal?.isVisible ?? false;
  const onPressCallbackRef = context?._internal?.onPressCallbackRef;

  const handlePress = useCallback(() => {
    onPressCallbackRef?.current?.();
  }, [onPressCallbackRef]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity?.value ?? 0,
  }));

  // If used outside provider, render nothing
  if (!context) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.backdrop, animatedStyle]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <Pressable style={styles.pressable} onPress={handlePress} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'black',
    // No zIndex - relies on render order. Must be rendered after content but before modal portals.
  },
  pressable: {
    flex: 1,
  },
});
