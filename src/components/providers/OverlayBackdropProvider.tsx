import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { SHEET } from '#constants/animations';
import { Pressable } from '#components/atoms/themedComponents';
import { navigationRef } from '#services/NavigationService';

export interface BackdropClaimOptions {
  opacity?: number;
  onPress?: () => void;
}

interface OverlayBackdropContextType {
  claim: (opts?: BackdropClaimOptions) => string;
  release: (id: string) => void;
}

interface OverlayBackdropInternalContextType {
  opacity: SharedValue<number>;
  isVisible: boolean;
  onPressRef: React.RefObject<(() => void) | null>;
}

const OverlayBackdropContext = createContext<OverlayBackdropContextType | null>(
  null,
);
const OverlayBackdropInternalContext =
  createContext<OverlayBackdropInternalContextType | null>(null);

export const useOverlayBackdrop = (): OverlayBackdropContextType => {
  const context = useContext(OverlayBackdropContext);
  if (!context) {
    throw new Error(
      'useOverlayBackdrop must be used within OverlayBackdropProvider',
    );
  }
  return context;
};

/**
 * Declarative backdrop claim. While `active` is true, the overlay is
 * painted; unmounting the consumer (for any reason — conditional render,
 * screen unmount, parent re-render) releases the claim via useEffect
 * cleanup. There is no manual decrement to leak.
 *
 * onPress is wrapped in a stable closure so updates to the prop don't
 * release/re-claim. opacity is captured at claim-time.
 */
export function useBackdropClaim(
  active: boolean,
  opts?: BackdropClaimOptions,
): void {
  const { claim, release } = useOverlayBackdrop();
  const onPressRef = useRef(opts?.onPress);
  useEffect(() => {
    onPressRef.current = opts?.onPress;
  });
  const [stableOnPress] = useState<() => void>(
    () => () => onPressRef.current?.(),
  );

  const opacityValue = opts?.opacity;
  useEffect(() => {
    if (!active) return;
    const id = claim({ opacity: opacityValue, onPress: stableOnPress });
    return () => release(id);
  }, [active, opacityValue, claim, release, stableOnPress]);
}

interface OverlayBackdropProviderProps {
  children: React.ReactNode;
}

interface BackdropHandlers {
  publicValue: OverlayBackdropContextType;
  onNavigationState: () => void;
}

/**
 * Tracks backdrop "claims" in a Map keyed by id. Visibility, opacity, and
 * the active onPress are derived from the registry whenever it changes.
 * The registry lives in a ref so claim/release don't re-render the
 * provider tree — only the `isVisible` flag (used to gate pointerEvents
 * on the paint surface) is React state.
 */
export const OverlayBackdropProvider: React.FC<
  OverlayBackdropProviderProps
> = ({ children }) => {
  const opacity = useSharedValue(0);
  const claimsRef = useRef<Map<string, BackdropClaimOptions>>(new Map());
  const nextIdRef = useRef(0);
  const onPressRef = useRef<(() => void) | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // All handlers are defined once via useState lazy init. They close over
  // only stable inputs (ref objects, useState's stable setter, useSharedValue's
  // stable instance), so first-render instances behave identically to any
  // later render's would. Stable identity → consumer useEffect deps don't
  // churn on provider re-renders.
  const [{ publicValue, onNavigationState }] = useState<BackdropHandlers>(
    () => {
      const recompute = () => {
        const claims = Array.from(claimsRef.current.values());
        const isActive = claims.length > 0;
        const target = isActive
          ? Math.max(...claims.map(c => c.opacity ?? 0.5))
          : 0;
        onPressRef.current = isActive
          ? claims[claims.length - 1].onPress ?? null
          : null;
        setIsVisible(isActive);
        opacity.set(
          withTiming(target, {
            duration: isActive
              ? SHEET.BACKDROP_FADE_IN
              : SHEET.BACKDROP_FADE_OUT,
          }),
        );
      };

      const claim = (opts?: BackdropClaimOptions): string => {
        const id = String(nextIdRef.current);
        nextIdRef.current += 1;
        claimsRef.current.set(id, opts ?? {});
        recompute();
        return id;
      };

      const release = (id: string): void => {
        if (!claimsRef.current.delete(id)) return;
        recompute();
      };

      return {
        publicValue: { claim, release },
        onNavigationState: () => {
          if (claimsRef.current.size === 0) return;
          claimsRef.current.clear();
          recompute();
        },
      };
    },
  );

  // Defense in depth: react-native-screens v4 freezes blurred screens via
  // <Activity mode="hidden">, which defers effect cleanups for the duration
  // of the visit. A consumer mounted on a screen the user has navigated
  // away from could keep its claim alive past its perceptual lifetime.
  // Wiping claims on every navigation state change ties the backdrop's
  // invariant to "what the active route's tree currently wants" — anything
  // still legitimately wanting it re-claims via its own effect on the next
  // render of the now-focused screen.
  useEffect(() => {
    const unsub = navigationRef.addListener('state', onNavigationState);
    return unsub;
  }, [onNavigationState]);

  const internalValue: OverlayBackdropInternalContextType = {
    opacity,
    isVisible,
    onPressRef,
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
 * Global backdrop component, rendered once at App level inside
 * BottomSheetModalProvider so bottom sheet portals stack above it.
 */
export const GlobalBackdrop: React.FC = () => {
  const internal = useContext(OverlayBackdropInternalContext);
  const opacity = internal?.opacity;
  const isVisible = internal?.isVisible ?? false;
  const onPressRef = internal?.onPressRef;

  const handlePress = () => {
    onPressRef?.current?.();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity?.get() ?? 0,
  }));

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
  },
  pressable: {
    flex: 1,
  },
});
