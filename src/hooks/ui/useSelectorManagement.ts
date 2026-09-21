import type { RefObject } from 'react';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';

interface UseSelectorManagementOptions {
  selectorRef: RefObject<ItemSelectorRef | null>;
  setOverlayOpen: (open: boolean) => void;
}

/** Opens/closes an `AnimatedItemSelector` alongside the overlay state. */
export function useSelectorManagement(options: UseSelectorManagementOptions) {
  const { selectorRef, setOverlayOpen } = options;

  const handleOpenSelector = () => {
    const selector = selectorRef.current;
    // An unmounted selector opens nothing, so the overlay must not be claimed.
    if (!selector) return;
    setOverlayOpen(true);
    selector.open();
  };

  const handleOverlayOpen = () => {
    setOverlayOpen(true);
  };

  const handleOverlayClose = () => {
    setOverlayOpen(false);
  };

  return {
    handleOpenSelector,
    handleOverlayOpen,
    handleOverlayClose,
  };
}
