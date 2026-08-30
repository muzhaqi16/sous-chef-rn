import { RefObject } from 'react';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';

interface UseSelectorManagementOptions {
  selectorRef: RefObject<ItemSelectorRef | null>;
  setOverlayOpen: (open: boolean) => void;
}

/** Opens/closes an `AnimatedItemSelector` alongside the overlay state. */
export function useSelectorManagement(options: UseSelectorManagementOptions) {
  const { selectorRef, setOverlayOpen } = options;

  const handleOpenSelector = () => {
    setOverlayOpen(true);
    selectorRef.current?.open();
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
