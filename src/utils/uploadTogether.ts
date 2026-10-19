import { errorService } from '#/services/errorService';

interface UploadTogetherOptions {
  /** Past this the rest are stopped and the whole set fails. */
  limitMs: number;
  /** Labels the report of a failure. */
  operation: string;
  onTimeout?: () => void;
}

/**
 * Every file's key, or null when one did not go up: they go together, and the
 * first failure, or the time limit, stops the rest. Only a failure the stop did
 * not cause is reported.
 */
export async function uploadTogether<File>(
  files: readonly File[],
  upload: (file: File, signal: AbortSignal) => Promise<string | null>,
  { limitMs, operation, onTimeout }: UploadTogetherOptions,
): Promise<string[] | null> {
  const sending = new AbortController();
  const limit = setTimeout(() => {
    onTimeout?.();
    sending.abort();
  }, limitMs);
  const keys = await Promise.all(
    files.map(async file => {
      let key: string | null = null;
      try {
        key = await upload(file, sending.signal);
      } catch (error) {
        if (!sending.signal.aborted) {
          errorService.reportError(error, { operation });
        }
      }
      if (!key) sending.abort();
      return key;
    }),
  );
  clearTimeout(limit);
  return keys.every(key => key !== null) ? keys : null;
}
