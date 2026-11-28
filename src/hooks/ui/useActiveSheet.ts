import { useState } from 'react';

export interface ActiveSheet<Sheet extends { type: string }> {
  active: Sheet | null;
  open: (sheet: Sheet) => void;
  /**
   * Closes the sheet of this type if it is still the open one, so a sheet's
   * late dismiss never closes the sheet that replaced it.
   */
  close: (type: Sheet['type']) => void;
}

/**
 * A screen's one open sheet among those it opens from its own actions, holding
 * what it shows: opening one closes the others it holds. A sheet a flow owns,
 * such as a write's batch-use sheet, keeps that flow's state instead, and
 * gorhom stacks the presentations.
 */
export function useActiveSheet<
  Sheet extends { type: string },
>(): ActiveSheet<Sheet> {
  const [active, setActive] = useState<Sheet | null>(null);
  return {
    active,
    open: setActive,
    close: type =>
      setActive(current => (current?.type === type ? null : current)),
  };
}
