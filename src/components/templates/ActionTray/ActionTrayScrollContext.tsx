import { createContext, useContext } from 'react';

export interface ActionTrayScrollContextValue {
  /**
   * Scroll the tray's scroll view so the given content Y offset is shown.
   * Used by content (e.g. selectors) to bring the active row into view on open.
   */
  scrollToContentOffset: (y: number, animated?: boolean) => void;
  /** Height of the visible scroll viewport in px (0 until laid out). */
  viewportHeight: number;
  /**
   * True once the sheet has settled at its open position. gorhom keeps the
   * scrollable locked while the sheet animates open, so programmatic scrolls
   * must wait for this before they take effect.
   */
  isReady: boolean;
}

export const ActionTrayScrollContext =
  createContext<ActionTrayScrollContextValue | null>(null);

export const useActionTrayScroll = () => useContext(ActionTrayScrollContext);
