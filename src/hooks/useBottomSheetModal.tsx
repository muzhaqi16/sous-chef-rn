import { useEffect, useRef, useState } from 'react';
import { type BottomSheetModalRef } from '#hooks/useStandardBottomSheet';

/**
 * Lightweight wrapper that exposes a `BottomSheetModal` ref plus `open()` /
 * `close()` helpers. Visibility is tracked in state and an effect dispatches
 * the imperative `present()` / `dismiss()` calls — this satisfies the
 * CLAUDE.md rule that present/dismiss must never be called directly outside
 * an effect.
 *
 * For most cases prefer `useStandardBottomSheet` which also bundles the
 * standard backdrop, animation configs, back handler, insets, and modalProps.
 * `useBottomSheetModal` exists for the few legacy callsites where the
 * BottomSheetModal is rendered manually with custom props.
 */
export const useBottomSheetModal = () => {
  const ref = useRef<BottomSheetModalRef>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  const open = () => setVisible(true);
  const close = () => setVisible(false);

  return { ref, open, close, visible };
};
