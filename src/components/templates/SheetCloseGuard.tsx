import { useEffect, useState } from 'react';
import { createValueContext } from '#hooks/utils/createValueContext';
import type { SheetDiscardGuard } from '#hooks/ui/useStandardBottomSheet';
import { confirmDiscardChanges } from '#services/destructiveConfirm';

/** One sheet's guard: whether its content holds input a close would drop. */
interface SheetCloseGuard extends SheetDiscardGuard {
  /** Marks input a close would drop, until the returned release runs. */
  hold: () => () => void;
}

function createSheetCloseGuard(): SheetCloseGuard {
  // One entry per reporter holding input: a sheet can stack a form on another.
  const holders = new Set<symbol>();
  return {
    holds: () => holders.size > 0,
    hold: () => {
      const holder = Symbol('unsaved input');
      holders.add(holder);
      return () => {
        holders.delete(holder);
      };
    },
    requestClose: close => {
      if (holders.size === 0) {
        close();
        return;
      }
      confirmDiscardChanges(() => {
        holders.clear();
        close();
      });
    },
  };
}

const CloseGuardContext =
  createValueContext<SheetCloseGuard>('SheetCloseGuard');

/** `Sheet`'s side: one guard per sheet, which its content reports to. */
export function useSheetCloseGuard(): SheetCloseGuard {
  const [guard] = useState(createSheetCloseGuard);
  return guard;
}

export const SheetCloseGuardProvider = CloseGuardContext.Provider;

/** For a close inside the sheet, such as its header's; none outside a sheet. */
export const useEnclosingSheetCloseGuard = CloseGuardContext.useOptionalValue;

/**
 * Reports that the enclosing sheet's content holds input a close would drop:
 * closing it by any route then asks first. A close the sheet's owner makes,
 * after a save, never asks.
 */
export function useSheetUnsavedInput(unsaved: boolean): void {
  const guard = CloseGuardContext.useOptionalValue();
  useEffect(() => {
    if (!unsaved || !guard) return;
    return guard.hold();
  }, [guard, unsaved]);
}
