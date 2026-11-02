import type { ApolloCache } from '@apollo/client';

/** The queue's replay timeout: a read that hangs never holds a write for longer. */
const MOST_WAITED_MS = 30_000;

interface Landing {
  landed: Promise<void>;
  land: () => void;
}

/**
 * The reads on their way to the server. A request sent after a mutation's
 * response sees its writes, so only a read already in flight when a write is
 * answered can hold state from before it: a confirmed write waits for those.
 */
export class ReadFence {
  private landings = new Set<Landing>();

  /** A read left; the result marks it landed, failed or closed. */
  begin(): () => void {
    let land: () => void = () => undefined;
    const landed = new Promise<void>(resolve => {
      land = resolve;
    });
    const landing = { landed, land };
    this.landings.add(landing);
    return () => {
      this.landings.delete(landing);
      landing.land();
    };
  }

  get isClear(): boolean {
    return this.landings.size === 0;
  }

  /** Settles once the reads in flight now have landed. */
  async passed(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.all([...this.landings].map(({ landed }) => landed)),
      new Promise(resolve => {
        timer = setTimeout(resolve, MOST_WAITED_MS);
      }),
    ]);
    clearTimeout(timer);
  }
}

const fences = new WeakMap<ApolloCache, ReadFence>();

export function readFenceOf(cache: ApolloCache): ReadFence {
  const known = fences.get(cache);
  if (known) return known;
  const created = new ReadFence();
  fences.set(cache, created);
  return created;
}
