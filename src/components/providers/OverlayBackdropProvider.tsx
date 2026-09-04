import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import Animated, {
  cancelAnimation,
  makeMutable,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet } from 'react-native-unistyles';
import { SHEET } from '#constants/animations';
import { Pressable } from '#components/atoms/themedComponents';
import { logger } from '#/utils/environment';

export interface BackdropClaimOptions {
  /** A fixed target the provider animates itself, or a SharedValue the contributor
   *  drives — e.g. a sheet's animatedIndex-interpolated opacity. */
  opacity?: number | SharedValue<number>;
  onPress?: () => void;
}

interface SlotEntry {
  id: string;
  sv: SharedValue<number>;
  /** true means the provider created and owns the SV; false means hands off. */
  ownedByProvider: boolean;
  onPress?: () => void;
}

interface OverlayBackdropContextType {
  /** Claim the backdrop; returns an id to pass to `release`. */
  claim: (opts?: BackdropClaimOptions) => string;
  /** Release a claim by id. Unknown ids (double-release) are a safe no-op. */
  release: (id: string) => void;
}

interface OverlayBackdropInternalContextType {
  opacity: SharedValue<number>;
  isVisible: boolean;
  onPress: (() => void) | null;
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

// Module-scoped for stable identity. `claim` returns '' so a paired `release`
// harmlessly finds no slot.
const NOOP_BACKDROP: OverlayBackdropContextType = {
  claim: () => '',
  release: () => {},
};

// One-shot guard so the missing-provider DEV warning fires once, not per render.
let missingProviderWarned = false;

/**
 * `useOverlayBackdrop` with a no-op fallback instead of a throw, for cross-cutting
 * hooks rendered in provider-less test trees. Warns once in DEV — hitting the
 * fallback in real code silently drops the dim layer.
 */
export const useOverlayBackdropOptional = (): OverlayBackdropContextType => {
  const context = useContext(OverlayBackdropContext);
  useEffect(() => {
    if (__DEV__ && !context && !missingProviderWarned) {
      missingProviderWarned = true;
      logger.warn(
        '[OverlayBackdropProvider] No <OverlayBackdropProvider> mounted above ' +
          'this consumer — backdrops will silently not appear. Expected only ' +
          'in unit-test trees; production must mount the provider at App root.',
      );
    }
  }, [context]);
  return context ?? NOOP_BACKDROP;
};

/**
 * The global dim opacity (max across claims, UI-thread driven), or null with no
 * provider. Chrome like the floating tab bar reads it to move in lockstep;
 * normalize by `SHEET.BACKDROP_OPACITY` for a 0…1 coverage value.
 */
export const useOverlayBackdropOpacity = (): SharedValue<number> | null => {
  const internal = useContext(OverlayBackdropInternalContext);
  return internal?.opacity ?? null;
};

/**
 * Whether any overlay claims the backdrop. Distinct from `isOverlayOpen` in
 * TabBarActionsContext, which selectors set explicitly to gate tutorial pausing —
 * a tutorial opens its own sheet, so it must not treat every backdrop as blocking.
 */
export const useOverlayBackdropPresence = (): boolean => {
  const internal = useContext(OverlayBackdropInternalContext);
  return internal?.isVisible ?? false;
};

/**
 * Declarative claim: painted while `active`, released by effect cleanup, so
 * nothing leaks. `onPress` is wrapped in a stable closure so prop updates don't
 * re-claim; changing `opacity` does re-claim.
 */
export function useBackdropClaim(
  active: boolean,
  opts?: BackdropClaimOptions,
): void {
  const { claim, release } = useOverlayBackdropOptional();
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

// Owns the claim registry. Global opacity is an owned SharedValue driven by a
// `useAnimatedReaction` over the max of all claim SVs, plus a JS-thread
// zero-floor. Every claim has a guaranteed release path through its consumer's
// unmount cleanup, so there is deliberately NO navigation-state listener wiping
// slots — that breaks the AddToPantrySheet → Barcode → back flow.
export const OverlayBackdropProvider: React.FC<
  OverlayBackdropProviderProps
> = ({ children }) => {
  const [slots, setSlots] = useState<readonly SlotEntry[]>([]);
  const slotsRef = useRef<readonly SlotEntry[]>(slots);
  useEffect(() => {
    slotsRef.current = slots;
  });
  const nextIdRef = useRef(0);

  // Presence, not opacity, so taps stay blocked across the whole fade window.
  const isVisible = slots.length > 0;

  // Latest claim owns the backdrop-tap handler.
  const onPress =
    slots.length > 0 ? slots[slots.length - 1].onPress ?? null : null;

  // Reanimated recurses into `slots` to track every `.sv`, so this re-runs as a
  // contributor animates and on any add/remove.
  const opacity = useSharedValue(0);
  useAnimatedReaction(
    () => {
      let max = 0;
      for (const entry of slots) {
        const v = entry.sv.value;
        if (v > max) max = v;
      }
      return max;
    },
    next => {
      opacity.set(next);
    },
  );

  // An empty slot set has no contributor SV left to drive the reaction down, so
  // force 0 from the JS thread. Only bites an interrupted close, where the portal
  // unmounts mid-animation and strands the dim and tab bar at ~half.
  useEffect(() => {
    if (slots.length === 0) opacity.set(0);
  }, [slots, opacity]);

  // Created once so `claim`/`release` are stable in consumers' effect deps; they
  // read the live slot list through `slotsRef`.
  const [publicValue] = useState<OverlayBackdropContextType>(() => {
    const removeSlot = (id: string): void => {
      // makeMutable SVs persist unless cancelled; leave external SVs alone.
      const entry = slotsRef.current.find(e => e.id === id);
      if (entry?.ownedByProvider) cancelAnimation(entry.sv);
      setSlots(prev => {
        if (!prev.some(e => e.id === id)) return prev;
        const next = prev.filter(e => e.id !== id);
        if (__DEV__) {
          logger.debug(
            `🎭 [OverlayBackdrop] release id=${id} → ${next.length} slot(s) remaining`,
          );
        }
        return next;
      });
    };

    const claim = (opts?: BackdropClaimOptions): string => {
      const id = String(nextIdRef.current);
      nextIdRef.current += 1;

      if (opts?.opacity !== undefined && typeof opts.opacity !== 'number') {
        const entry: SlotEntry = {
          id,
          sv: opts.opacity,
          ownedByProvider: false,
          onPress: opts.onPress,
        };
        setSlots(prev => {
          const next = [...prev, entry];
          if (__DEV__) {
            logger.debug(
              `🎭 [OverlayBackdrop] claim id=${id} (external SV) → ${next.length} slot(s)`,
            );
          }
          return next;
        });
        return id;
      }

      const target = (opts?.opacity as number | undefined) ?? 0.5;
      const sv = makeMutable(0);
      sv.set(withTiming(target, { duration: SHEET.BACKDROP_FADE_IN }));
      const entry: SlotEntry = {
        id,
        sv,
        ownedByProvider: true,
        onPress: opts?.onPress,
      };
      setSlots(prev => {
        const next = [...prev, entry];
        if (__DEV__) {
          logger.debug(
            `🎭 [OverlayBackdrop] claim id=${id} (owned) → ${next.length} slot(s)`,
          );
        }
        return next;
      });
      return id;
    };

    const release = (id: string): void => {
      const entry = slotsRef.current.find(e => e.id === id);

      // An interrupting claim still fires this callback; removeSlot's `.some`
      // guard makes that a no-op.
      if (entry?.ownedByProvider) {
        entry.sv.set(
          withTiming(0, { duration: SHEET.BACKDROP_FADE_OUT }, () => {
            'worklet';
            scheduleOnRN(removeSlot, id);
          }),
        );
        return;
      }

      // Never early-return on a missing entry: a fast claim→release outruns the
      // `slotsRef` sync, and removeSlot's functional setSlots still removes it.
      // Returning here strands the slot with a frozen non-zero SV.
      removeSlot(id);
    };

    return { claim, release };
  });

  const internalValue: OverlayBackdropInternalContextType = {
    opacity,
    isVisible,
    onPress,
  };

  return (
    <OverlayBackdropContext.Provider value={publicValue}>
      <OverlayBackdropInternalContext.Provider value={internalValue}>
        {children}
      </OverlayBackdropInternalContext.Provider>
    </OverlayBackdropContext.Provider>
  );
};

/** Rendered once at App level inside BottomSheetModalProvider, so sheets stack above. */
export const GlobalBackdrop: React.FC = () => {
  const internal = useContext(OverlayBackdropInternalContext);
  const opacity = internal?.opacity;
  const isVisible = internal?.isVisible ?? false;
  const onPress = internal?.onPress;

  const handlePress = () => {
    onPress?.();
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
      <Pressable
        style={styles.pressable}
        onPress={handlePress}
        accessible={false}
      />
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
