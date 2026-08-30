import { useEffect, useRef, useState, type RefObject } from 'react';
import { useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useOverlayBackdropOptional } from '#components/providers/OverlayBackdropProvider';
import { useSheetBackdropOpacity } from '#hooks/useSheetBackdropOpacity';

interface DismissableRef {
  dismiss: () => void;
}

/**
 * Backdrop integration for a `BottomSheetModal`: hand `animatedIndex`,
 * `onChange` and `onAnimate` to gorhom. Claims the global dim at the START of
 * the open animation (no pop-in), releases on the settled-closed `onChange(-1)`
 * — a MODAL dismiss can strand `animatedIndex` above -1.
 */
export function useBottomSheetBackdropClaim(
  ref: RefObject<DismissableRef | null>,
): {
  animatedIndex: SharedValue<number>;
  onChange: (index: number) => void;
  onAnimate: (fromIndex: number, toIndex: number) => void;
  /** Stable release, for a caller that already knows the sheet is going away. */
  release: () => void;
} {
  const { animatedIndex, backdropOpacity: opacitySV } =
    useSheetBackdropOpacity();

  const { claim, release } = useOverlayBackdropOptional();
  const claimIdRef = useRef<string | null>(null);
  const onPressRef = useRef(() => ref.current?.dismiss());
  useEffect(() => {
    onPressRef.current = () => ref.current?.dismiss();
  });
  const [stableOnPress] = useState<() => void>(
    () => () => onPressRef.current(),
  );

  const claimBackdrop = () => {
    if (claimIdRef.current != null) return;
    claimIdRef.current = claim({ opacity: opacitySV, onPress: stableOnPress });
  };

  const releaseBackdrop = () => {
    if (claimIdRef.current == null) return;
    release(claimIdRef.current);
    claimIdRef.current = null;
  };

  // Stable RN-scope identity for the `scheduleOnRN` boundary below, still
  // calling the latest `releaseBackdrop`.
  const releaseRef = useRef(releaseBackdrop);
  useEffect(() => {
    releaseRef.current = releaseBackdrop;
  });
  const [stableRelease] = useState<() => void>(
    () => () => releaseRef.current(),
  );

  // The guaranteed release backstop; via `stableRelease` so it runs on unmount
  // only, not on every render.
  useEffect(() => {
    return () => stableRelease();
  }, [stableRelease]);

  // BACKSTOP only, for interrupted closes where gorhom skips `onChange(-1)`.
  // Never the sole release path: a MODAL dismiss can strand the SV above -0.999.
  // Additive and idempotent, and a fast reopen never fires it.
  useAnimatedReaction(
    () => animatedIndex.get() <= -0.999,
    (closed, previous) => {
      if (closed && previous === false) scheduleOnRN(stableRelease);
    },
  );

  // CLAIM at the START of the open animation, so the dim ramps in lockstep with
  // the sheet. `onAnimate` fires one step before gorhom drives
  // `animatedPosition`; `onChange(index >= 0)` is the idempotent backstop for a
  // `present()` while already open, where `onAnimate` early-returns.
  const onAnimate = (_fromIndex: number, toIndex: number) => {
    if (toIndex >= 0) claimBackdrop();
  };

  // RELEASE on settled-closed — the reliable MODAL signal, also reached via
  // `useStandardBottomSheet`'s `safeOnDismiss`. Without it, a dismiss that
  // strands `animatedIndex` leaves the slot claimed and an invisible backdrop
  // eats every tap.
  const onChange = (index: number) => {
    if (index >= 0) claimBackdrop();
    else if (index === -1) releaseBackdrop();
  };

  return { animatedIndex, onChange, onAnimate, release: stableRelease };
}
