import { useEffect, useRef, useState } from 'react';
import { skipToken, useMutation, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  ReceiptParseStatus,
  ReceiptParseWarningCode,
} from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { getDeviceLocale } from '#/utils/deviceLocale';
import { isNetworkError } from '#/utils/isNetworkError';
import { getRateLimitDetails } from '#/utils/errors/rateLimit';
import { useIsOnline } from '#store/useAppStore';
import {
  useReceiptDraftStore,
  type ServerReceiptParse,
} from '../store/receiptDraftStore';
import { fromServerReceipt } from '../utils/serverReceipt';
import { receiptReviewLines } from '../utils/receiptReviewLines';
import type { ParsedReceipt } from '../utils/structureReceipt';
import {
  CreateReceiptParseDocument,
  ReceiptParseDocument,
  type ReceiptParseQuery,
} from './useServerReceiptParse.generated';

// The API asks for a poll every 2–3 s and allows 120 a minute.
const POLL_MS = 2500;

/** What the saved screen says about the server's reading. */
export type ServerReadingStatus =
  | 'none'
  | 'reading'
  | 'offline'
  | 'unreadable'
  | 'unavailable'
  | 'limited';

type Outcome =
  | Exclude<ServerReceiptParse['state'], 'limited'>
  | { parsed: ParsedReceipt; purchasedOn?: string };

/** What a finished parse leaves on the draft; nothing while it runs. */
function outcomeOf(
  parse: NonNullable<ReceiptParseQuery['receiptParse']>,
): Outcome | undefined {
  switch (parse.status) {
    case ReceiptParseStatus.Pending:
      return undefined;
    case ReceiptParseStatus.Failed:
      return 'failed';
    case ReceiptParseStatus.Unavailable:
      return 'unavailable';
    case ReceiptParseStatus.Parsed: {
      const { receipt } = parse;
      const lowText = parse.warnings.some(
        warning => warning.code === ReceiptParseWarningCode.LowText,
      );
      const parsed = receipt ? fromServerReceipt(receipt) : null;
      // Never an empty review: too little text to read is a retake.
      if (!receipt || !parsed || lowText) return 'unreadable';
      if (receiptReviewLines(parsed).length === 0) return 'unreadable';
      return receipt.purchasedOn
        ? { parsed, purchasedOn: receipt.purchasedOn }
        : { parsed };
    }
  }
}

/**
 * Asks the server to read a saved receipt the phone could not structure, and
 * waits for it while the screen is open: never part of the scan itself, which
 * `enabled` marks as finished. A parse already asked for is sent again on the
 * next visit, which the API answers with the same parse; offline, nothing is
 * asked until the phone is back online.
 */
export function useServerReceiptParse({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const draft = useReceiptDraftStore(state => state.draft);
  const askServerParse = useReceiptDraftStore(state => state.askServerParse);
  const settleServerParse = useReceiptDraftStore(
    state => state.settleServerParse,
  );
  const [create] = useMutation(CreateReceiptParseDocument);
  // The parse this visit sent, so it is sent once per visit, never in a loop.
  const sent = useRef<string | null>(null);
  const [polling, setPolling] = useState<string | null>(null);

  const asked = draft?.serverParse;
  const waiting =
    enabled &&
    !!draft &&
    !draft.parsed &&
    (!asked || asked.state === 'pending' || asked.state === 'limited');

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
    const send = async () => {
      let error: unknown;
      const settled = await settleMutation(
        async () => {
          const result = await create({
            variables: {
              input: { id, pages: draft.pages, ...(locale ? { locale } : {}) },
            },
          });
          error = result.error;
          return result;
        },
        {
          document: CreateReceiptParseDocument,
          fallback: t('errors.generic'),
          // The draft's text stands whatever the server says.
          present: 'none',
        },
      );
      const status = appliedPayload(settled.data)?.receiptParse.status;
      if (status === ReceiptParseStatus.Unavailable) {
        settleServerParse(id, 'unavailable');
      } else if (status === ReceiptParseStatus.Failed) {
        settleServerParse(id, 'failed');
      } else if (status) {
        setPolling(id);
      } else if (!isNetworkError(error)) {
        // The daily allowance is asked again once it says; any other refusal
        // is not, as for UNAVAILABLE.
        const retryAfter = getRateLimitDetails(error)?.retryAfter;
        settleServerParse(
          id,
          retryAfter && retryAfter > 0
            ? {
                retryAt: new Date(Date.now() + retryAfter * 1000).toISOString(),
              }
            : 'unavailable',
        );
      }
      // Otherwise no answer came: still pending, sent again next visit.
    };
    void send();
  }, [
    waiting,
    isOnline,
    asked,
    draft,
    askServerParse,
    settleServerParse,
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
      return isOnline ? 'reading' : 'offline';
    }
    if (asked.state === 'limited') return 'limited';
    return asked.state === 'unreadable' ? 'unreadable' : 'unavailable';
  };

  return {
    readingStatus: readingStatus(),
    /** When a receipt over the daily allowance is read on the next visit. */
    retryAt: asked?.state === 'limited' ? new Date(asked.retryAt) : undefined,
  };
}
