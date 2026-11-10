/**
 * What a user does that a tour step can wait for. Every path that does it
 * emits it, so a step continues however the action was done.
 */
export type TutorialEvent =
  | 'list.itemAdded'
  | 'list.movedToPantry'
  | 'list.rowSwiped'
  | 'recipe.cooked';

type Listener = (event: TutorialEvent) => void;

const listeners = new Set<Listener>();

/** Completes a tour step waiting for `event`; nothing when none waits. */
export function emitTutorialEvent(event: TutorialEvent): void {
  for (const listener of [...listeners]) listener(event);
}

/** Listens for tour events; returns the unsubscribe. */
export function onTutorialEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
