import { useEffect, useState } from 'react';
import { useOpening } from '#hooks/ui/useOpening';

interface UseDeferredSheetFetchOptions {
  open: boolean;
  /** pantryId or shoppingListId: a new one waits again. */
  contextId: string | undefined;
  /** Defaults to true. */
  deferFetch?: boolean;
}

/**
 * Whether an add sheet's suggestions may be fetched: from the frame after it
 * opens, so the query does not start under the open animation, or at once with
 * `deferFetch` off. Each opening waits again.
 */
export function useDeferredSheetFetch({
  open,
  contextId,
  deferFetch = true,
}: UseDeferredSheetFetchOptions): boolean {
  const opening = useOpening(open);
  const key = opening ? `${opening.id}:${contextId ?? ''}` : null;
  const [readyFor, setReadyFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !deferFetch || key === null) return;
    const rafId = requestAnimationFrame(() => setReadyFor(key));
    return () => cancelAnimationFrame(rafId);
  }, [open, deferFetch, key]);

  return open && (!deferFetch || readyFor === key);
}
