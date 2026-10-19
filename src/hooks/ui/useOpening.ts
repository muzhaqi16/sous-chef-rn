import { useState } from 'react';

/**
 * A new `id` each time `visible` turns on, with the `payload` it opened with,
 * kept while the sheet animates out. Keyed on the id, a sheet's form starts
 * fresh per opening. Null until the first opening.
 */
export function useOpening<Payload = undefined>(
  visible: boolean,
  payload?: Payload,
): { id: number; payload: Payload | undefined } | null {
  const [opening, setOpening] = useState<{
    id: number;
    payload: Payload | undefined;
  } | null>(null);
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setOpening({ id: (opening?.id ?? 0) + 1, payload });
  }
  return opening;
}
