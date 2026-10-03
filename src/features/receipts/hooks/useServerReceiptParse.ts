import { useEffect, useRef, useState } from 'react';
import {
  skipToken,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import { useTranslation } from '#/i18n';
import {
  ReceiptParseStatus,
  ReceiptParseWarningCode,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import {
  appliedPayload,
  validationFieldName,
} from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { getDeviceLocale } from '#/utils/deviceLocale';
import { todayKey } from '#/utils/dateUtils';
import { getRateLimitDetails } from '#/utils/errors/rateLimit';
import { isAuthRefusalCode } from '#/utils/authErrorCodes';
import { useIsOnline } from '#store/useAppStore';
import {
  ReceiptParseReadersFragmentDoc,
  type ReceiptParseReadersFragment,
} from '#/graphql/readers/receiptParseReaders.generated';
import {
  useReceiptDraftStore,
  type ServerReceiptParse,
} from '../store/receiptDraftStore';
import { fromServerReceipt } from '../utils/serverReceipt';
import { isPlausibleReceiptDay } from '../utils/receiptDate';
import { receiptReviewLines } from '../utils/receiptReviewLines';
import type { ParsedReceipt } from '../utils/structureReceipt';
import {
  CreateReceiptParseDocument,
  ReceiptParseDocument,
  type ReceiptParseQuery,
} from './useServerReceiptParse.generated';

// The API asks for a poll every 2–3 s and allows 120 a minute.
const POLL_MS = 2500;

// The waits before each resend of an ask that got no verdict; after the last,
// it is sent again on the next visit.
const RESEND_MS = [POLL_MS, POLL_MS * 2, POLL_MS * 4];

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

const PASSING_CODES: readonly string[] = [
  TopLevelErrorCode.InternalServerError,
  TopLevelErrorCode.ServiceUnavailable,
];

/**
 * Whether a failed ask is the API's answer on this receipt, which stands. One
 * that never arrived, a server fault and a session mid-refresh are not: the
 * same ask may well succeed when sent again.
 */
function isVerdict(error: unknown): boolean {
  if (ServerError.is(error)) {
    return error.statusCode < 500 && error.statusCode !== 401;
  }
  if (!CombinedGraphQLErrors.is(error)) return false;
  return error.errors.every(({ extensions }) => {
    const code = extensions?.code;
    return (
      typeof code === 'string' &&
      !PASSING_CODES.includes(code) &&
      !isAuthRefusalCode(code)
    );
  });
}

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
      // Held to the phone's own window: a misread day would date the prices
      // and the shelf life, and the API refuses one after tomorrow.
      return receipt.purchasedOn &&
        isPlausibleReceiptDay(receipt.purchasedOn, todayKey())
        ? { parsed, purchasedOn: receipt.purchasedOn }
        : { parsed };
    }
  }
}

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
  const draft = useReceiptDraftStore(state => state.draft);
  const askServerParse = useReceiptDraftStore(state => state.askServerParse);
  const settleServerParse = useReceiptDraftStore(
    state => state.settleServerParse,
  );
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
      let error: unknown;
      const settled = await settleMutation(
        async () => {
          const result = await create({
            variables: {
              input: { id, ...content, ...(locale ? { locale } : {}) },
            },
          }).catch((thrown: unknown) => {
            error = thrown;
            throw thrown;
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
      const retryAfter = getRateLimitDetails(error)?.retryAfter;
      if (status === ReceiptParseStatus.Unavailable) {
        settleServerParse(id, 'unavailable');
      } else if (status === ReceiptParseStatus.Failed) {
        settleServerParse(id, 'failed');
      } else if (status) {
        // A finished parse (a resend, or a fast worker) is settled from what
        // the payload wrote to the cache, without a poll.
        const parse =
          status === ReceiptParseStatus.Parsed
            ? client.cache.readFragment<ReceiptParseReadersFragment>({
                id: client.cache.identify({ __typename: 'ReceiptParse', id }),
                fragment: ReceiptParseReadersFragmentDoc,
              })
            : null;
        const outcome = parse ? outcomeOf(parse) : undefined;
        if (outcome === undefined) setPolling(id);
        else settleServerParse(id, outcome);
      } else if (validationFieldName(settled.data) === 'pages') {
        // Every refusal on `pages` is a size bound: the scan caps the pages at
        // ten, so it is the character limit, which only the API knows.
        settleServerParse(id, 'tooLong');
      } else if (retryAfter && retryAfter > 0) {
        // The daily allowance is asked again once it says.
        settleServerParse(id, {
          retryAt: new Date(Date.now() + retryAfter * 1000).toISOString(),
        });
      } else if (error === undefined || isVerdict(error)) {
        // A refusal, in the payload or not, stands, as UNAVAILABLE does.
        settleServerParse(id, 'unavailable');
      } else {
        // No verdict: still pending, sent again shortly, then next visit.
        const wait = RESEND_MS[resends];
        if (wait === undefined) {
          setGaveUp(true);
        } else {
          resendTimer.current = setTimeout(() => {
            if (sent.current !== id) return;
            sent.current = null;
            setResends(count => count + 1);
          }, wait);
        }
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
