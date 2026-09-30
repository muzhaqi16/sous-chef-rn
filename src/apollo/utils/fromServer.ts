import { useStore } from '#store';
import { isNetworkWithheld } from '#store/slices/networkSlice';

/**
 * The server's answer to `send` (a `network-only` query), or `undefined`.
 * `offlineModeLink` answers a withheld query from the cache, and a cached
 * answer must not be stamped fresh by a time-to-live refresh.
 */
export async function fromServer<TData>(
  send: () => Promise<{ data?: TData; error?: unknown }>,
): Promise<TData | undefined> {
  if (isNetworkWithheld(useStore.getState())) return undefined;
  const { data, error } = await send();
  return error ? undefined : data;
}
