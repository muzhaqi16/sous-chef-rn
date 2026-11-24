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
 * A screen's one open sheet, holding what it shows. Opening one closes any
 * other, so two never stack.
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
