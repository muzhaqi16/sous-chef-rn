import { useCallback, RefObject } from 'react';
import type { ItemSelectorRef } from '#components/organisms/AnimatedItemSelector/types';

interface UseSelectorManagementOptions {
  /**
   * Reference to the AnimatedItemSelector component
   */
  selectorRef: RefObject<ItemSelectorRef | null>;

  /**
   * Function to set overlay open/closed state
   */
  setOverlayOpen: (open: boolean) => void;
}

/**
 * Hook to manage AnimatedItemSelector with overlay coordination
 *
 * Provides handlers for opening and closing selectors while
 * coordinating with overlay state management.
 *
 * @param options - Configuration options
 * @returns Object with selector management handlers
 *
 * @example
 * ```typescript
 * const selectorRef = useRef<ItemSelectorRef>(null);
 * const { setOverlayOpen } = useScanner();
 *
 * const { handleOpenSelector, handleOverlayOpen, handleOverlayClose } =
 *   useSelectorManagement({
 *     selectorRef,
 *     setOverlayOpen,
 *   });
 *
 * <Button onPress={handleOpenSelector}>Open Selector</Button>
 * <AnimatedItemSelector
 *   ref={selectorRef}
 *   onOpen={handleOverlayOpen}
 *   onClose={handleOverlayClose}
 * />
 * ```
 */
export function useSelectorManagement(options: UseSelectorManagementOptions) {
  const { selectorRef, setOverlayOpen } = options;

  /**
   * Open the selector and overlay
   */
  const handleOpenSelector = useCallback(() => {
    setOverlayOpen(true);
    selectorRef.current?.open();
  }, [setOverlayOpen, selectorRef]);

  /**
   * Handle overlay open event from selector
   */
  const handleOverlayOpen = useCallback(() => {
    setOverlayOpen(true);
  }, [setOverlayOpen]);

  /**
   * Handle overlay close event from selector
   */
  const handleOverlayClose = useCallback(() => {
    setOverlayOpen(false);
  }, [setOverlayOpen]);

  return {
    handleOpenSelector,
    handleOverlayOpen,
    handleOverlayClose,
  };
}
