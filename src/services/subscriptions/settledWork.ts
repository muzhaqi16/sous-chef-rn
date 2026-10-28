/**
 * Work the server finishes in the background, announced on the user's event
 * stream so the screen waiting on it asks once instead of polling.
 */
export interface SettledWork {
  kind: 'receiptParse' | 'recipeCapture';
  id: string;
}

const listeners = new Set<(work: SettledWork) => void>();

export function announceWorkSettled(work: SettledWork): void {
  listeners.forEach(listener => listener(work));
}

/** Calls `listener` for each piece of work that settles; returns the unsubscribe. */
export function onWorkSettled(
  listener: (work: SettledWork) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
