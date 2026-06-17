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
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { StyleSheet } from 'react-native-unistyles';
import { SHEET } from '#constants/animations';
import { Pressable } from '#components/atoms/themedComponents';

export interface BackdropClaimOptions {
  /** Either a fixed target opacity (provider creates an internal SV and
   *  animates 0 → target on claim, target → 0 on release via withTiming),
   *  OR a SharedValue<number> the contributor drives externally (e.g. a
   *  `useDerivedValue` interpolated from a bottom sheet's `animatedIndex`).
   *
   *  The SV path keeps the backdrop in lockstep with the sheet's motion
   *  on the UI thread — same pattern as gorhom's built-in BottomSheetBackdrop.
   *  In the SV path, release removes the slot immediately (the contributor's
   *  SV is already at 0 by the time release is called: gorhom fires
   *  `onChange(-1)` after the sheet hits its closed snap point, and
   *  release is wired off that event). */
  opacity?: number | SharedValue<number>;
  onPress?: () => void;
}

interface SlotEntry {
  id: string;
  /** The opacity SharedValue this slot contributes. `ownedByProvider: true`
   *  → created by `claim()` via `makeMutable`, animated via withTiming on
   *  claim and release. `ownedByProvider: false` → contributor-supplied
   *  (e.g. a useDerivedValue from a sheet's animatedIndex). */
  sv: SharedValue<number>;
  ownedByProvider: boolean;
  onPress?: () => void;
}

interface OverlayBackdropContextType {
  /** Imperative claim — provider creates an internal SharedValue, animates
   *  it from 0 → `opacity` immediately, returns an id. Pair with `release()`. */
  claim: (opts?: BackdropClaimOptions) => string;
  /** Release a claim by id. The provider animates its SharedValue to 0 over
   *  `BACKDROP_FADE_OUT` and removes the slot when the timing completes.
   *  Calling with an unknown id (e.g., double-release) is a safe no-op. */
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

// No-op fallback returned by `useOverlayBackdropOptional` when no provider
// is mounted. The `claim` returns an empty-string id so a paired `release`
// is a harmless no-op via `slotsRef.find`'s undefined branch (no real claim
// to find). Defined at module scope so identity is stable across calls.
const NOOP_BACKDROP: OverlayBackdropContextType = {
  claim: () => '',
  release: () => {},
};

// One-shot `__DEV__` warning guard so the fallback is loud about misuse in
// development without spamming the console on every render. Mutated only
// from inside a useEffect (post-commit), never during render.
const missingProviderWarning = { fired: false };

/**
 * Like `useOverlayBackdrop` but returns a no-op fallback when no provider
 * is mounted, instead of throwing. Use this from cross-cutting hooks
 * (e.g. `useStandardBottomSheet`) that may be rendered in unit-test trees
 * without an `OverlayBackdropProvider` wrapper. Real app code always
 * mounts the provider at App root, so the fallback is only exercised by
 * tests.
 *
 * If the fallback is hit in DEV (i.e. production code accidentally rendered
 * outside the provider — e.g. someone deleted the provider mount, or
 * mounted a sheet above it in the tree), warn once. The fallback silently
 * loses the dim layer; the warning makes that diagnosable.
 */
export const useOverlayBackdropOptional = (): OverlayBackdropContextType => {
  const context = useContext(OverlayBackdropContext);
  useEffect(() => {
    if (__DEV__ && !context && !missingProviderWarning.fired) {
      missingProviderWarning.fired = true;
      console.warn(
        '[OverlayBackdropProvider] useOverlayBackdropOptional fell back to ' +
          'a no-op — no <OverlayBackdropProvider> is mounted above this ' +
          'consumer. Backdrops will silently not appear. This is expected ' +
          'only in unit-test trees; in production code, mount the provider ' +
          'at App root.',
      );
    }
  }, [context]);
  return context ?? NOOP_BACKDROP;
};

/**
 * Read the global overlay dim opacity as a SharedValue (the max across all
 * active claims, driven on the UI thread). Returns null when no provider is
 * mounted (e.g. unit-test trees).
 *
 * This is the single source of truth for "an overlay is covering the screen,
 * and how far along its open/close animation is." Chrome other than the dim
 * layer — e.g. the floating tab bar — reads it to react in lockstep with the
 * sheet on the UI thread, instead of maintaining a second registry. Normalize
 * by the claim's target opacity (`SHEET.BACKDROP_OPACITY`) to recover a 0…1
 * coverage value.
 */
export const useOverlayBackdropOpacity = (): SharedValue<number> | null => {
  const internal = useContext(OverlayBackdropInternalContext);
  return internal?.opacity ?? null;
};

/**
 * Declarative backdrop claim. While `active` is true, the overlay is painted;
 * unmounting the consumer (for any reason — conditional render, screen
 * unmount, parent re-render) releases the claim via useEffect cleanup. There
 * is no manual decrement to leak.
 *
 * - `onPress` is wrapped in a stable closure so updates to the prop don't
 *   release/re-claim.
 * - `opacity` is reactive: changing it releases the current claim and
 *   creates a new one. For static numeric opacity this would cause a fade-
 *   out + fade-in flicker, but consumers never mutate it in practice. For
 *   SharedValue<number> opacity (used by sheets), identity is stable across
 *   the hook's lifetime, so reactivity is a no-op.
 */
export function useBackdropClaim(
  active: boolean,
  opts?: BackdropClaimOptions,
): void {
  // Use the optional variant so cross-cutting consumers (e.g. sheets
  // rendered in unit-test trees without an `OverlayBackdropProvider`
  // wrapper) silently no-op instead of throwing. Real app code mounts
  // the provider at App root, so the fallback is only exercised by tests.
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

interface BackdropHandlers {
  publicValue: OverlayBackdropContextType;
}

/**
 * Tracks backdrop claims — each is a provider-owned SharedValue<number>
 * representing one consumer's opacity contribution. The global opacity is a
 * `useDerivedValue` reading the max across all claim SVs; `isVisible` (which
 * gates pointerEvents) derives from claim count.
 *
 * All claim SVs are owned by the provider and animated via `withTiming` on
 * claim and release, so the provider has full control over the SV's
 * lifetime. No external contributor can keep writing to a slot SV after the
 * slot has been logically removed — that race vector (which produced stuck
 * overlays after sheet dismiss / barcode round trip) is structurally gone.
 *
 * Sheet backdrops claim/release imperatively from
 * `useStandardBottomSheet` via gorhom's `onChange(index)` callback (see that
 * file). `ActionTray` and any other static overlays use `useBackdropClaim`.
 *
 * There is intentionally no `navigationRef.addListener('state', …)` safety
 * net. The old listener wiped all slots on every navigation state change,
 * which broke the AddToPantrySheet → BarcodeStack → back flow: the slot
 * was released when the user pushed into Barcode, the sheet stayed at
 * index 0 (gorhom never fired `onChange(-1)`), and on return the sheet was
 * visible with no dim layer because the hook's `slotIdRef.current` was
 * still held. With imperative `onChange`-driven claim/release plus the
 * hook's defensive unmount cleanup, every claim has a guaranteed release
 * path and the listener becomes net-negative.
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

  // pointerEvents tracks claim presence (not opacity value) so taps are
  // blocked through the entire fade-in/fade-out window.
  const isVisible = slots.length > 0;

  // Latest claim's onPress is the active backdrop handler. Derived inline
  // each provider render — no ref needed because the context's
  // `internalValue` is rebuilt every render anyway (so a ref wouldn't save
  // any consumer re-renders).
  const onPress =
    slots.length > 0 ? slots[slots.length - 1].onPress ?? null : null;

  // Global opacity = max of all claim SharedValues. Re-registered when
  // `slots` identity changes (add/remove); Reanimated auto-tracks each
  // `.value` read inside the worklet as a dep so it re-runs whenever any
  // contributing SV changes — including external SVs (e.g. a sheet's
  // animatedIndex-interpolated opacity), which is how the backdrop stays
  // in lockstep with the sheet's motion on the UI thread.
  const opacity = useDerivedValue(() => {
    let max = 0;
    for (const entry of slots) {
      const v = entry.sv.value;
      if (v > max) max = v;
    }
    return max;
  }, [slots]);

  const [{ publicValue }] = useState<BackdropHandlers>(() => {
    const removeSlot = (id: string): void => {
      // Cancel any in-flight animation on a provider-owned SV before
      // dropping it (per Reanimated docs — `makeMutable` SVs persist
      // unless cancelled). External SVs are driven by the contributor;
      // we don't own their animation lifecycle, so don't touch them.
      const entry = slotsRef.current.find(e => e.id === id);
      if (entry?.ownedByProvider) cancelAnimation(entry.sv);
      setSlots(prev =>
        prev.some(e => e.id === id) ? prev.filter(e => e.id !== id) : prev,
      );
    };

    const claim = (opts?: BackdropClaimOptions): string => {
      const id = String(nextIdRef.current);
      nextIdRef.current += 1;

      // External SV path: contributor drives the value (typically a
      // useDerivedValue interpolated from a sheet's animatedIndex). Use
      // it directly — no withTiming, no provider-side animation.
      if (opts?.opacity !== undefined && typeof opts.opacity !== 'number') {
        const entry: SlotEntry = {
          id,
          sv: opts.opacity,
          ownedByProvider: false,
          onPress: opts.onPress,
        };
        setSlots(prev => [...prev, entry]);
        return id;
      }

      // Static path: provider creates an internal SV and animates 0 →
      // target via withTiming. Used by ActionTray and any other consumer
      // that doesn't have its own opacity source.
      const target = (opts?.opacity as number | undefined) ?? 0.5;
      const sv = makeMutable(0);
      sv.set(withTiming(target, { duration: SHEET.BACKDROP_FADE_IN }));
      const entry: SlotEntry = {
        id,
        sv,
        ownedByProvider: true,
        onPress: opts?.onPress,
      };
      setSlots(prev => [...prev, entry]);
      return id;
    };

    const release = (id: string): void => {
      const entry = slotsRef.current.find(e => e.id === id);
      if (!entry) return;

      if (!entry.ownedByProvider) {
        // External SV: contributor (the sheet) has already animated the
        // value to 0 — `release` is called from `onChange(-1)` which
        // gorhom fires AFTER animatedIndex hits the closed position, so
        // the interpolated opacity is at 0. Remove immediately.
        removeSlot(id);
        return;
      }

      // Provider-owned: animate to 0, then drop the slot when the timing
      // finishes. If interrupted (e.g. a new claim arrives mid-fade),
      // the callback still fires; the `.some` guard in removeSlot makes
      // that a no-op.
      entry.sv.set(
        withTiming(0, { duration: SHEET.BACKDROP_FADE_OUT }, () => {
          'worklet';
          scheduleOnRN(removeSlot, id);
        }),
      );
    };

    return { publicValue: { claim, release } };
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
 * Global backdrop component, rendered once at App level inside
 * BottomSheetModalProvider so bottom sheet portals stack above it.
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
