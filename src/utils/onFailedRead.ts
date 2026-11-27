/**
 * Runs a read nothing awaits. Under `errorPolicy: 'all'` its failure RESOLVES
 * with `error`, and only an abort rejects, so a `.catch` alone hears neither
 * the server nor the network: `onFailure` hears both.
 */
export function onFailedRead(
  read: Promise<{ error?: unknown }>,
  onFailure: (error: unknown) => void,
): void {
  void read.then(({ error }) => {
    if (error) onFailure(error);
  }, onFailure);
}
