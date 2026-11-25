import { useEffect, useState } from 'react';
import { createValueContext } from '#hooks/utils/createValueContext';
import type { SheetDiscardGuard } from '#hooks/ui/useStandardBottomSheet';
import { confirmDiscardChanges } from '#services/destructiveConfirm';

/** One sheet's guard: whether its content holds input a close would drop. */
interface SheetCloseGuard extends SheetDiscardGuard {
  setHolds: (holds: boolean) => void;
}

function createSheetCloseGuard(): SheetCloseGuard {
  let holding = false;
  return {
    holds: () => holding,
    setHolds: next => {
      holding = next;
    },
    requestClose: close => {
      if (!holding) {
        close();
        return;
      }
      confirmDiscardChanges(() => {
        holding = false;
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
    guard?.setHolds(unsaved);
  }, [guard, unsaved]);
  useEffect(
    () => () => {
      guard?.setHolds(false);
    },
    [guard],
  );
}
