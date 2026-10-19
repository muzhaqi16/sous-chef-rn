import { useCaptureLink } from '#features/recipes/store/recipeCaptureStore';
import { useFinishedCapture } from './useFinishedCapture';

/** What an incomplete capture read and the link it was sent; null until read. */
export function useCaptureDraft(captureId: string | undefined) {
  const capture = useFinishedCapture(captureId);
  const link = useCaptureLink(captureId);
  return { draft: capture?.draft ?? null, link };
}
