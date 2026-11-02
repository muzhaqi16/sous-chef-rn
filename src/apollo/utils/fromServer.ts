import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';

/**
 * The server's answer to `send` (a `network-only` query), or `undefined`.
 * `offlineReadLink` answers an offline query from the cache, and a cached
 * answer must not be stamped fresh by a time-to-live refresh.
 */
export async function fromServer<TData>(
  send: () => Promise<{ data?: TData; error?: unknown }>,
): Promise<TData | undefined> {
  if (isApiUnavailable(useStore.getState())) return undefined;
  const { data, error } = await send();
  return error ? undefined : data;
}
