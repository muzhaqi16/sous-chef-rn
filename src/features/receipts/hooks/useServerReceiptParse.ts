import { useEffect, useRef, useState } from 'react';
import {
  skipToken,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { getDeviceLocale } from '#/utils/deviceLocale';
import { backoffDelay } from '#/utils/backoff';
import { useIsOnline } from '#store/useAppStore';
import {
  ReceiptParseReadersFragmentDoc,
  type ReceiptParseReadersFragment,
} from '#/graphql/readers/receiptParseReaders.generated';
import {
  useReceiptDraft,
  useReceiptDraftActions,
} from '../store/receiptDraftStore';
import { classifyCreateResult, outcomeOf } from '../utils/serverReceipt';
import {
  CreateReceiptParseDocument,
  ReceiptParseDocument,
} from './useServerReceiptParse.generated';

// The API asks for a poll every 2–3 s and allows 120 a minute.
const POLL_MS = 2500;

// An ask that got no verdict is resent after a poll, then two, then four;
// after the last, it is sent again on the next visit.
const RESENDS_PER_VISIT = 3;

/** What the saved screen says about the server's reading. */
export type ServerReadingStatus =
  | 'none'
  | 'reading'
  | 'offline'
  | 'retryLater'
  | 'unreadable'
  | 'unavailable'
  | 'tooLong'
  | 'limited';

/**
 * Asks the server to read a saved receipt the phone could not structure, and
 * waits for it while the screen is open: never part of the scan itself, which
 * `enabled` marks as finished. An ask that got no verdict is sent again while
 * the screen is open, a few times, then on the next visit; the API answers a
 * resend with the same parse. Offline, nothing is asked until the phone is back
 * online.
 */
export function useServerReceiptParse({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const draft = useReceiptDraft();
  const { askServerParse, settleServerParse } = useReceiptDraftActions();
  const client = useApolloClient();
  const [create] = useMutation(CreateReceiptParseDocument);
  // The parse this visit sent, so it is sent once per visit, never in a loop.
  const sent = useRef<string | null>(null);
  const [polling, setPolling] = useState<string | null>(null);
  // Resends this visit of an ask that got no verdict.
  const [resends, setResends] = useState(0);
  const resendTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [gaveUp, setGaveUp] = useState(false);

  // Resends belong to one receipt: "Scan another" on this screen starts the
  // next one afresh, and a wait left from the last one never fires for it.
  const receiptKey = draft?.scannedAt ?? null;
  const [resendsFor, setResendsFor] = useState(receiptKey);
  if (resendsFor !== receiptKey) {
    setResendsFor(receiptKey);
    setResends(0);
    setGaveUp(false);
  }
  useEffect(() => () => clearTimeout(resendTimer.current), [receiptKey]);

  const asked = draft?.serverParse;
  // A refused photo parse loses its photos with it, so one over the daily
  // allowance waits for a new scan, never a resend.
  const resendsWhenAllowed = !draft?.photoKeys;
  const waiting =
    enabled &&
    !!draft &&
    !draft.parsed &&
    (!asked ||
      asked.state === 'pending' ||
      (asked.state === 'limited' && resendsWhenAllowed));

  useEffect(() => {
    if (!waiting || !isOnline) return;
    if (asked?.state === 'limited' && Date.now() < Date.parse(asked.retryAt)) {
      return;
    }
    const id = draft.serverParse?.id ?? generateEntityId();
    if (sent.current === id) return;
    sent.current = id;
    askServerParse(id);
    const locale = getDeviceLocale();
    // The text, or the photos of a receipt the phone could not read.
    const content = draft.photoKeys
      ? { photos: draft.photoKeys }
      : { pages: draft.pages };
    const send = async () => {
      const settled = await settleMutation(
        () =>
          create({
            variables: {
              input: { id, ...content, ...(locale ? { locale } : {}) },
            },
          }),
        {
          document: CreateReceiptParseDocument,
          fallback: t('errors.generic'),
          // The draft's text stands whatever the server says.
          present: 'none',
        },
      );
      // A finished parse (a resend, or a fast worker) is settled from what
      // the payload wrote to the cache, without a poll.
      const parse = client.cache.readFragment<ReceiptParseReadersFragment>({
        id: client.cache.identify({ __typename: 'ReceiptParse', id }),
        fragment: ReceiptParseReadersFragmentDoc,
      });
      const result = classifyCreateResult({
        accepted: !!appliedPayload(settled.data),
        parse,
        refusedField: settled.failure?.field ?? null,
        error: settled.error,
      });
      switch (result.kind) {
        case 'poll':
          setPolling(id);
          return;
        case 'settle':
          settleServerParse(id, result.outcome);
          return;
        case 'later':
          setGaveUp(true);
          return;
        case 'resend':
          if (resends >= RESENDS_PER_VISIT) {
            setGaveUp(true);
            return;
          }
          resendTimer.current = setTimeout(() => {
            if (sent.current !== id) return;
            sent.current = null;
            setResends(count => count + 1);
          }, backoffDelay(resends, { baseMs: POLL_MS }));
      }
    };
    void send();
  }, [
    waiting,
    isOnline,
    asked,
    draft,
    resends,
    askServerParse,
    settleServerParse,
    client,
    create,
    t,
  ]);

  const polled = polling && asked?.id === polling && asked.state === 'pending';
  const { data } = useQuery(
    ReceiptParseDocument,
    polled
      ? {
          variables: { id: polling },
          pollInterval: POLL_MS,
          fetchPolicy: 'network-only',
          // Polled while open; nothing for the resync to refresh.
          refetchOn: false,
        }
      : skipToken,
  );

  useEffect(() => {
    if (!polled || !data) return;
    const parse = data.receiptParse;
    // Gone (seven days on) or never this user's: the text stands.
    if (!parse) {
      settleServerParse(polling, 'unavailable');
      return;
    }
    if (parse.id !== polling) return;
    const outcome = outcomeOf(parse);
    if (outcome !== undefined) settleServerParse(polling, outcome);
  }, [polled, polling, data, settleServerParse]);

  const readingStatus = (): ServerReadingStatus => {
    if (!enabled || !draft || draft.parsed) return 'none';
    if (!asked || asked.state === 'pending') {
      if (!isOnline) return 'offline';
      return gaveUp ? 'retryLater' : 'reading';
    }
    switch (asked.state) {
      case 'limited':
      case 'unreadable':
      case 'tooLong':
        return asked.state;
      case 'unavailable':
      case 'failed':
        return 'unavailable';
    }
  };

  return {
    readingStatus: readingStatus(),
    /** When a receipt over the daily allowance is read on the next visit. */
    retryAt: asked?.state === 'limited' ? new Date(asked.retryAt) : undefined,
  };
}
