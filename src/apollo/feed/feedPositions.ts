/** Where a scope stands against the server. Cursors compare only for equality. */
export interface FeedPosition {
  kind: string;
  cursor: string;
  /** When the scope was last read in full, which dates what the feed omits. */
  snapshotAt: number;
}

const positions = new Map<string, FeedPosition>();
const listeners = new Set<() => void>();

const announce = (): void => {
  listeners.forEach(listener => listener());
};

export const positionOf = (scopeId: string): FeedPosition | undefined =>
  positions.get(scopeId);

/** The scopes the feed has taken on. Only these can leave on its say-so. */
export const heldScopes = (): ReadonlyMap<string, FeedPosition> => positions;

export function holdPosition(scopeId: string, position: FeedPosition): void {
  const first = !positions.has(scopeId);
  positions.set(scopeId, position);
  if (first) announce();
}

export function forgetPosition(scopeId: string): void {
  if (positions.delete(scopeId)) announce();
}

export function clearPositions(): void {
  if (positions.size === 0) return;
  positions.clear();
  announce();
}

/** For `useSyncExternalStore`: told when a scope starts or stops being held. */
export function subscribeToPositions(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
