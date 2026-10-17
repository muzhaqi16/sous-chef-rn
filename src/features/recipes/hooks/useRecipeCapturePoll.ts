import { useEffect, useRef, useState } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import {
  CAPTURE_DEADLINE_MS,
  type CaptureEntry,
} from '#features/recipes/store/recipeCaptureStore';
import {
  captureOutcomeOf,
  UNANSWERED_CAPTURE,
} from '#features/recipes/utils/recipeCaptureOutcome';
import { RecipeCaptureDocument } from './useRecipeCapture.generated';
import { useCaptureOutcomeReporter } from './useCaptureOutcomeReporter';

/** A structured page answers in seconds; a model read takes longer. */
const FAST_POLL_MS = 2000;
const SLOW_POLL_MS = 5000;
const FAST_FOR_MS = 30_000;

/**
 * Polls one capture while it reads and reports how it ended. Paused while the
 * API is unreachable, resumed when it is back; past the server's deadline it
 * is reported unanswered.
 */
export function useRecipeCapturePoll(entry: CaptureEntry): void {
  const unavailable = useIsApiUnavailable();
  const report = useCaptureOutcomeReporter();
  const reportRef = useRef(report);
  useEffect(() => {
    reportRef.current = report;
  });

  const reading = entry.state === 'reading';
  const startedAt = Date.parse(entry.createdAt);

  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!reading) return;
    const timer = setTimeout(
      () => setSlow(true),
      Math.max(0, startedAt + FAST_FOR_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [reading, startedAt]);

  useEffect(() => {
    if (!reading) return;
    const timer = setTimeout(
      () => reportRef.current(entry.id, UNANSWERED_CAPTURE),
      Math.max(0, startedAt + CAPTURE_DEADLINE_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [reading, entry.id, startedAt]);

  // Asked for only once its create is answered: a poll sent beside the create
  // can reach the server first and be told no such capture exists.
  const polled = reading && entry.answered && !unavailable;
  const { data } = useQuery(
    RecipeCaptureDocument,
    polled
      ? {
          variables: { id: entry.id },
          pollInterval: slow ? SLOW_POLL_MS : FAST_POLL_MS,
          fetchPolicy: 'network-only',
          // A poll re-renders only on data.
          notifyOnNetworkStatusChange: false,
          // Polled while it reads; nothing for the resync to refresh.
          refetchOn: false,
        }
      : skipToken,
  );

  useEffect(() => {
    if (!polled || !data) return;
    const capture = data.recipeCapture;
    // Never arrived (every resend lost), or not this account's.
    if (!capture) {
      reportRef.current(entry.id, UNANSWERED_CAPTURE);
      return;
    }
    const outcome = captureOutcomeOf(capture);
    if (outcome) reportRef.current(entry.id, outcome);
  }, [polled, data, entry.id]);
}
