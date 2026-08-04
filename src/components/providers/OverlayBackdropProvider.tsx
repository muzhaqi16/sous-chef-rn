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
  /** A fixed target opacity (provider creates + animates an internal SV via
   *  withTiming on claim/release), or a SharedValue the contributor drives
   *  itself — e.g. a sheet's animatedIndex-interpolated opacity, kept in
   *  lockstep with the sheet on the UI thread. */
  opacity?: number | SharedValue<number>;
  onPress?: () => void;
}

interface SlotEntry {
  id: string;
  sv: SharedValue<number>;
  /** true → provider created the SV (makeMutable) and owns its animation;
   *  false → contributor-supplied SV the provider must not touch. */
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

// No-op fallback for `useOverlayBackdropOptional` when no provider is mounted
// (unit-test trees). `claim` returns '' so a paired `release` harmlessly finds
// no slot. Module-scoped for stable identity.
const NOOP_BACKDROP: OverlayBackdropContextType = {
  claim: () => '',
  release: () => {},
};

// One-shot guard so the missing-provider DEV warning fires once, not per render.
let missingProviderWarned = false;

/**
 * Like `useOverlayBackdrop` but returns a no-op fallback instead of throwing
 * when no provider is mounted — for cross-cutting hooks (e.g.
 * `useStandardBottomSheet`) rendered in unit-test trees without the provider.
 * Warns once in DEV, since hitting the fallback in real code silently drops the
 * dim layer.
 */
export const useOverlayBackdropOptional = (): OverlayBackdropContextType => {
  const context = useContext(OverlayBackdropContext);
  useEffect(() => {
    if (__DEV__ && !context && !missingProviderWarned) {
      missingProviderWarned = true;
      console.warn(
        '[OverlayBackdropProvider] No <OverlayBackdropProvider> mounted above ' +
          'this consumer — backdrops will silently not appear. Expected only ' +
          'in unit-test trees; production must mount the provider at App root.',
      );
    }
  }, [context]);
  return context ?? NOOP_BACKDROP;
};

/**
 * The global dim opacity SharedValue (max across active claims, UI-thread
 * driven), or null when no provider is mounted. The single source of truth for
 * "an overlay covers the screen, and how far through its animation." Chrome
 * like the floating tab bar reads it to react in lockstep; normalize by
 * `SHEET.BACKDROP_OPACITY` for a 0…1 coverage value.
 */
export const useOverlayBackdropOpacity = (): SharedValue<number> | null => {
  const internal = useContext(OverlayBackdropInternalContext);
  return internal?.opacity ?? null;
};

/**
 * Whether any overlay is currently claiming the backdrop (slot count > 0). The
 * floating tab bar reads it to reset its scroll-hidden state when an overlay
 * opens. Distinct from `isOverlayOpen` in TabBarActionsContext, which selectors
 * set explicitly to gate tutorial pausing (a tutorial may open its own sheet,
 * so it must not treat every backdrop as blocking).
 */
export const useOverlayBackdropPresence = (): boolean => {
  const internal = useContext(OverlayBackdropInternalContext);
  return internal?.isVisible ?? false;
};

/**
 * Declarative backdrop claim: painted while `active`, released on unmount via
 * effect cleanup — nothing to leak. `onPress` is wrapped in a stable closure so
 * prop updates don't re-claim; `opacity` is reactive (changing it re-claims),
 * but consumers keep it stable in practice.
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

/**
 * Owns the backdrop claim registry. Global opacity is an owned SharedValue
 * driven by a `useAnimatedReaction` over the max of all claim SVs, with a
 * JS-thread zero-floor when nothing is claimed; `isVisible` (gating
 * pointerEvents) is claim count > 0.
 *
 * Sheets claim/release imperatively from `useStandardBottomSheet` via gorhom's
 * `onChange`; `ActionTray` and other static overlays use `useBackdropClaim`.
 * Every claim has a guaranteed release path (the consumer's unmount cleanup),
 * so there is deliberately no navigation-state listener wiping slots — that
 * approach broke the AddToPantrySheet → Barcode → back flow.
 */
export const OverlayBackdropProvider: React.FC<
  OverlayBackdropProviderProps
> = ({ children }) => {
  const [slots, setSlots] = useState<readonly SlotEntry[]>([]);
  const slotsRef = useRef<readonly SlotEntry[]>(slots);
  useEffect(() => {
    slotsRef.current = slots;
  });
  const nextIdRef = useRef(0);

  // Track claim presence (not opacity) so taps are blocked across the whole
  // fade-in/out window.
  const isVisible = slots.length > 0;

  // Latest claim owns the backdrop-tap handler.
  const onPress =
    slots.length > 0 ? slots[slots.length - 1].onPress ?? null : null;

  // Global dim opacity = max across active claim SVs, on the UI thread.
  // Reanimated recurses into `slots` to track every `.sv`, so the reaction
  // re-runs as a contributor animates and on any add/remove.
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
    [slots],
  );

  // Zero-floor: an empty slot set has no contributor SV left to drive the
  // reaction down, so force opacity to 0 from the JS thread. Normal closes
  // already animate to 0 before the slot is removed; this only bites an
  // interrupted close (portal unmounts mid-animation, stranding the sheet's
  // animatedIndex), which otherwise strands the dim and tab bar at ~half.
  useEffect(() => {
    if (slots.length === 0) opacity.set(0);
  }, [slots, opacity]);

  // Created once so `claim`/`release` have stable identity for consumers' effect
  // deps; they read the live slot list through `slotsRef`.
  const [publicValue] = useState<OverlayBackdropContextType>(() => {
    const removeSlot = (id: string): void => {
      // Cancel a provider-owned SV's in-flight animation before dropping it
      // (makeMutable SVs persist unless cancelled); leave external SVs alone.
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

      // External SV: use the contributor's value directly, no provider animation.
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

      // Static: provider creates an SV and animates 0 → target (ActionTray etc.).
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

      // Provider-owned: fade to 0, then drop the slot. An interrupting claim
      // still fires this callback; removeSlot's `.some` guard makes it a no-op.
      if (entry?.ownedByProvider) {
        entry.sv.set(
          withTiming(0, { duration: SHEET.BACKDROP_FADE_OUT }, () => {
            'worklet';
            scheduleOnRN(removeSlot, id);
          }),
        );
        return;
      }

      // External SV: remove immediately. Don't early-return on a missing entry —
      // a fast claim→release can outrun the `slotsRef` sync, but removeSlot's
      // functional setSlots reads authoritative state and still removes it.
      // Early-returning here stranded the slot with a frozen non-zero SV.
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

/**
 * The global dim layer, rendered once at App level inside
 * BottomSheetModalProvider so sheet portals stack above it.
 */
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
