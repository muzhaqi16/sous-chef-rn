import { useState } from 'react';

export interface ActiveSheet<Sheet> {
  active: Sheet | null;
  open: (sheet: Sheet) => void;
  close: () => void;
}

/**
 * A screen's one open sheet, holding what it shows. Opening one closes any
 * other, so two never stack.
 */
export function useActiveSheet<Sheet>(): ActiveSheet<Sheet> {
  const [active, setActive] = useState<Sheet | null>(null);
  return {
    active,
    open: setActive,
    close: () => setActive(null),
  };
}
