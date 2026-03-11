import React, { createContext, useContext, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet } from 'react-native-unistyles';
import { SHEET } from '#constants/animations';

interface ShowBackdropOptions {
  opacity?: number;
  onPress?: () => void;
}

interface OverlayBackdropContextType {
  showBackdrop: (options?: ShowBackdropOptions) => void;
  hideBackdrop: () => void;
}

// Internal context for GlobalBackdrop — separated so public consumers
// (useOverlayBackdrop) don't re-render when isVisible changes.
interface OverlayBackdropInternalContextType {
  opacity: SharedValue<number>;
  isVisible: boolean;
  onPressCallbackRef: React.RefObject<(() => void) | null>;
}

const OverlayBackdropContext = createContext<OverlayBackdropContextType | null>(null);
const OverlayBackdropInternalContext = createContext<OverlayBackdropInternalContextType | null>(null);

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
 * Split into public (callbacks) and internal (animation state) contexts
 * so consumers using only showBackdrop/hideBackdrop don't re-render
 * when backdrop visibility changes.
 */
export const OverlayBackdropProvider: React.FC<OverlayBackdropProviderProps> = ({
  children }) => {
  // Use shared values only for animation-related values
  const opacity = useSharedValue(0);

  // Use regular React state/refs for non-animation values
  const [isVisible, setIsVisible] = useState(false);
  const onPressCallbackRef = useRef<(() => void) | null>(null);
  const activeCountRef = useRef(0);

  const showBackdrop = (options?: ShowBackdropOptions) => {
    activeCountRef.current += 1;
    const targetOpacity = options?.opacity ?? 0.5;
    onPressCallbackRef.current = options?.onPress ?? null;
    setIsVisible(true);
    opacity.set(withTiming(targetOpacity, { duration: SHEET.BACKDROP_FADE_IN }));
  };

  const hideBackdrop = () => {
    activeCountRef.current = Math.max(0, activeCountRef.current - 1);
    if (activeCountRef.current === 0) {
      onPressCallbackRef.current = null;
      opacity.set(withTiming(0, { duration: SHEET.BACKDROP_FADE_OUT }, (finished) => {
        if (finished) {
          scheduleOnRN(setIsVisible, false);
        }
      }));
    }
  };

  const publicValue: OverlayBackdropContextType = {
    showBackdrop,
    hideBackdrop,
  };

  const internalValue: OverlayBackdropInternalContextType = {
    opacity,
    isVisible,
    onPressCallbackRef,
  };

  return (
    <OverlayBackdropContext.Provider value={publicValue}>
      <OverlayBackdropInternalContext.Provider value={internalValue}>
        {children}
      </OverlayBackdropInternalContext.Provider>
    </OverlayBackdropContext.Provider>
  );
};

/**
 * Global backdrop component that should be rendered inside BottomSheetModalProvider.
 * This allows the backdrop to be in the same stacking context as bottom sheet modals,
 * ensuring modals render on top of the backdrop.
 */
export const GlobalBackdrop: React.FC = () => {
  const internal = useContext(OverlayBackdropInternalContext);

  // Get values from context (may be undefined if no provider)
  const opacity = internal?.opacity;
  const isVisible = internal?.isVisible ?? false;
  const onPressCallbackRef = internal?.onPressCallbackRef;

  const handlePress = () => {
    onPressCallbackRef?.current?.();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity?.value ?? 0 }));

  // If used outside provider, render nothing
  if (!internal) {
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
    flex: 1 } });
