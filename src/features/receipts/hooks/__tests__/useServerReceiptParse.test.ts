'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import { GraphQLError } from 'graphql';
import { ServerError } from '@apollo/client/errors';
import {
  ErrorCode,
  ReceiptLineKind,
  ReceiptParseStatus,
  ReceiptParseWarningCode,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import { TimeoutError } from '#/utils/errors/timeoutError';
import {
  useReceiptDraftStore,
  type ReceiptDraft,
} from '../../store/receiptDraftStore';
import { seedDraft } from '../../__tests__/helpers/receiptFixtures';
import {
  CreateReceiptParseDocument,
  ReceiptParseDocument,
} from '../useServerReceiptParse.generated';
import { useServerReceiptParse } from '../useServerReceiptParse';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/errorService');

const PAGES = ['WALMART\nGV WHOLE MILK 007874235186 F  3.48 N\nTOTAL  3.48'];

const seedMilkDraft = (draft: Partial<ReceiptDraft> = {}) =>
  seedDraft({ pages: PAGES, purchasedOn: '2026-09-30', ...draft });

const created = (
  answer: ReceiptParseStatus | Error,
  {
    receipt = null,
    maxUsageCount,
  }: { receipt?: typeof MILK_RECEIPT | null; maxUsageCount?: number } = {},
) =>
  recordMock(
    CreateReceiptParseDocument,
    answer instanceof Error
      ? { error: answer, maxUsageCount }
      : {
          maxUsageCount,
          dataFor: (vars): MockDataFor<typeof CreateReceiptParseDocument> => ({
            createReceiptParse: {
              __typename: 'CreateReceiptParsePayload',
              receiptParse: {
                id: String(inputOf(vars).id),
                status: answer,
                warnings: [],
                receipt,
              },
            },
          }),
        },
  );

const MILK_RECEIPT = {
  merchant: { name: 'WALMART', address: '100 Main St', storeNumber: ' ' },
  purchasedOn: '2026-09-29',
  lines: [
    {
      text: 'GV WHOLE MILK 007874235186 F 3.48 N',
      kind: ReceiptLineKind.Item,
      product: 'GV WHOLE MILK',
      code: '007874235186',
      amount: 3.48,
    },
    { text: 'TOTAL 3.48', kind: ReceiptLineKind.Total, amount: 3.48 },
  ],
};

// The server answers PENDING once, then its reading. One mock per answer: the
// harness completes a mock once per variables, so a single one cannot change.
const polledTo = (
  last: Omit<
    NonNullable<MockDataFor<typeof ReceiptParseDocument>['receiptParse']>,
    'id'
  >,
) => {
  const pending = recordMock(ReceiptParseDocument, {
    maxUsageCount: 1,
    dataFor: vars => ({
      receiptParse: {
        id: String(vars.id),
        status: ReceiptParseStatus.Pending,
        warnings: [],
        receipt: null,
      },
    }),
  });
  const done = recordMock(ReceiptParseDocument, {
    dataFor: vars => ({ receiptParse: { id: String(vars.id), ...last } }),
  });
  return {
    mocks: [pending.mock, done.mock],
    fired: () => [...pending.fired, ...done.fired],
  };
};

function render(
  operationMocks: MockedResponse[],
  { enabled = true }: { enabled?: boolean } = {},
) {
  return renderHookWithApollo(() => useServerReceiptParse({ enabled }), {
    operationMocks,
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  useStore.setState({ isOnline: true });
  useReceiptDraftStore.setState({ draft: null });
});

afterEach(() => {
  jest.useRealTimers();
});

const pollOnce = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(3000);
  });

describe('useServerReceiptParse', () => {
  it('asks the server once the scan is saved, and fills the draft from its reading', async () => {
    seedMilkDraft();
    const create = created(ReceiptParseStatus.Pending);
    const poll = polledTo({
      status: ReceiptParseStatus.Parsed,
      warnings: [],
      receipt: MILK_RECEIPT,
    });
    const { result } = render([create.mock, ...poll.mocks]);

    await waitFor(() => expect(create.fired).toHaveLength(1));
    expect(create.fired[0]).toEqual({
      input: expect.objectContaining({ id: expect.any(String), pages: PAGES }),
    });
    expect(result.current.readingStatus).toBe('reading');

    await pollOnce();
    await pollOnce();
    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.parsedBy).toBe('server');
    expect(draft?.parsed?.merchant).toBe('WALMART');
    expect(draft?.parsed?.lines[0]).toMatchObject({
      kind: 'item',
      product: 'GV WHOLE MILK',
      lineTotal: 3.48,
    });
    // The shop as printed, to place or propose a store; a blank number is none.
    expect(draft?.printedStore).toEqual({
      name: 'WALMART',
      address: '100 Main St',
    });
    // The day the phone read before redaction stands.
    expect(draft?.purchasedOn).toBe('2026-09-30');
    expect(draft?.serverParse).toBeUndefined();
    expect(result.current.readingStatus).toBe('none');
  });

  it.each([
    [
      "takes the server's day when the phone read none",
      '2026-09-29',
      '2026-09-29',
    ],
    ['drops a day the server read in the future', '2026-12-29', undefined],
    // OCR noise at a receipt's top (`86/9/18`) read as a day years back.
    ['drops a day the server read years back', '2018-09-06', undefined],
  ])('%s', async (_name, served, kept) => {
    jest.setSystemTime(new Date(2026, 9, 1, 12));
    seedMilkDraft({ purchasedOn: undefined });
    const poll = polledTo({
      status: ReceiptParseStatus.Parsed,
      warnings: [],
      receipt: { ...MILK_RECEIPT, purchasedOn: served },
    });
    render([created(ReceiptParseStatus.Pending).mock, ...poll.mocks]);

    await pollOnce();
    await pollOnce();

    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.parsedBy).toBe('server');
    expect(draft?.purchasedOn).toBe(kept);
  });

  it('reads a parse the server has already finished from its answer, with no poll', async () => {
    seedMilkDraft();
    const create = created(ReceiptParseStatus.Parsed, {
      receipt: MILK_RECEIPT,
    });
    const poll = polledTo({
      status: ReceiptParseStatus.Parsed,
      warnings: [],
      receipt: MILK_RECEIPT,
    });
    const { result } = render([create.mock, ...poll.mocks]);

    await waitFor(() => expect(result.current.readingStatus).toBe('none'));
    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.parsedBy).toBe('server');
    expect(draft?.parsed?.merchant).toBe('WALMART');
    expect(poll.fired()).toEqual([]);
  });

  it('keeps the text when no receipt worker runs, and asks nothing more', async () => {
    seedMilkDraft();
    const create = created(ReceiptParseStatus.Unavailable);
    const poll = polledTo({
      status: ReceiptParseStatus.Parsed,
      warnings: [],
      receipt: MILK_RECEIPT,
    });
    const { result } = render([create.mock, ...poll.mocks]);

    await waitFor(() =>
      expect(result.current.readingStatus).toBe('unavailable'),
    );
    await pollOnce();
    expect(poll.fired()).toEqual([]);
    expect(create.fired).toHaveLength(1);
    expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
  });

  it('calls a receipt the server could barely read unreadable, never an empty review', async () => {
    seedMilkDraft();
    const { result } = render([
      created(ReceiptParseStatus.Pending).mock,
      ...polledTo({
        status: ReceiptParseStatus.Parsed,
        warnings: [{ code: ReceiptParseWarningCode.LowText }],
        receipt: MILK_RECEIPT,
      }).mocks,
    ]);

    await pollOnce();
    await pollOnce();

    expect(result.current.readingStatus).toBe('unreadable');
    expect(useReceiptDraftStore.getState().draft?.parsed).toBeUndefined();
  });

  it.each([
    [
      'keeps the totals the server found do not add up',
      { counted: 22.97, printed: 27.94 },
      { counted: 22.97, printed: 27.94 },
    ],
    // An API from before its discount rule sends no figures; its check misfired.
    [
      'drops a mismatch the server gives no figures for',
      { counted: null, printed: null },
      undefined,
    ],
  ])('%s', async (_name, figures, kept) => {
    seedMilkDraft();
    render([
      created(ReceiptParseStatus.Pending).mock,
      ...polledTo({
        status: ReceiptParseStatus.Parsed,
        warnings: [
          { code: ReceiptParseWarningCode.TotalsMismatch, ...figures },
        ],
        receipt: MILK_RECEIPT,
      }).mocks,
    ]);

    await pollOnce();
    await pollOnce();

    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.parsedBy).toBe('server');
    expect(draft?.totalsGap).toEqual(kept);
  });

  const overTheLimit = (
    retryAfter?: number,
  ): MockFor<typeof CreateReceiptParseDocument> => ({
    request: { query: CreateReceiptParseDocument, variables: () => true },
    result: {
      errors: [
        new GraphQLError('Too many receipt parses today', {
          extensions: {
            code: TopLevelErrorCode.RateLimitExceeded,
            ...(retryAfter === undefined ? {} : { retryAfter }),
          },
        }),
      ],
    },
  });

  it('sends a receipt the phone could not read as its photos, not its text', async () => {
    seedMilkDraft({ pages: [], photoKeys: ['receipt-photos/u1/p1.jpg'] });
    const create = created(ReceiptParseStatus.Pending);
    render([create.mock]);

    await waitFor(() => expect(create.fired).toHaveLength(1));
    expect(create.fired[0]).toEqual({
      input: {
        id: expect.any(String),
        photos: ['receipt-photos/u1/p1.jpg'],
        locale: expect.any(String),
      },
    });
  });

  it("fills a photo draft from the server's reading, as for text", async () => {
    seedMilkDraft({ pages: [], photoKeys: ['receipt-photos/u1/p1.jpg'] });
    const create = created(ReceiptParseStatus.Pending);
    const poll = polledTo({
      status: ReceiptParseStatus.Parsed,
      warnings: [],
      receipt: MILK_RECEIPT,
    });
    render([create.mock, ...poll.mocks]);

    await waitFor(() => expect(create.fired).toHaveLength(1));
    await pollOnce();
    await pollOnce();

    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.parsedBy).toBe('server');
    expect(draft?.parsed?.merchant).toBe('WALMART');
    expect(draft?.serverParse).toBeUndefined();
  });

  it('never asks again for photos the daily limit turned away: they are gone', async () => {
    seedMilkDraft({ pages: [], photoKeys: ['receipt-photos/u1/p1.jpg'] });
    const { result, unmount } = render([overTheLimit(3600)]);
    await waitFor(() => expect(result.current.readingStatus).toBe('limited'));
    unmount();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(3_600_000);
    });
    const later = created(ReceiptParseStatus.Pending);
    const next = render([later.mock]);
    await pollOnce();

    expect(later.fired).toEqual([]);
    expect(next.result.current.readingStatus).toBe('limited');
  });

  it('waits out the daily limit, then asks again on a later visit', async () => {
    seedMilkDraft();
    const { result, unmount } = render([overTheLimit(3600)]);

    await waitFor(() => expect(result.current.readingStatus).toBe('limited'));
    const asked = useReceiptDraftStore.getState().draft?.serverParse;
    expect(asked).toEqual({
      id: expect.any(String),
      via: 'text',
      state: 'limited',
      retryAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(result.current.retryAt).toEqual(new Date(Date.now() + 3_600_000));
    unmount();

    // Before the hour is up, a visit asks nothing.
    const early = created(ReceiptParseStatus.Pending);
    const second = render([early.mock]);
    await pollOnce();
    expect(early.fired).toEqual([]);
    expect(second.result.current.readingStatus).toBe('limited');
    second.unmount();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(3_600_000);
    });
    const later = created(ReceiptParseStatus.Pending);
    const third = render([later.mock]);
    await waitFor(() => expect(later.fired).toHaveLength(1));
    expect(later.fired[0]).toEqual({
      input: expect.objectContaining({ id: asked?.id }),
    });
    expect(third.result.current.readingStatus).toBe('reading');
  });

  describe('a receipt with its text and its photos', () => {
    const PHOTOS = ['receipt-photos/u1/p1.jpg', 'receipt-photos/u1/p2.jpg'];

    // The photos fail as `photoStatus`; the text is accepted and read later.
    const photosThenText = (photoStatus: ReceiptParseStatus) =>
      recordMock(CreateReceiptParseDocument, {
        dataFor: (vars): MockDataFor<typeof CreateReceiptParseDocument> => {
          const input = inputOf(vars);
          return {
            createReceiptParse: {
              __typename: 'CreateReceiptParsePayload',
              receiptParse: {
                id: String(input.id),
                status:
                  'photos' in input ? photoStatus : ReceiptParseStatus.Pending,
                warnings: [],
                receipt: null,
              },
            },
          };
        },
      });

    it('sends the photos first', async () => {
      seedMilkDraft({ photoKeys: PHOTOS });
      const create = created(ReceiptParseStatus.Pending);
      render([create.mock]);

      await waitFor(() => expect(create.fired).toHaveLength(1));
      expect(create.fired[0]).toEqual({
        input: {
          id: expect.any(String),
          photos: PHOTOS,
          locale: expect.any(String),
        },
      });
      expect(useReceiptDraftStore.getState().draft?.serverParse).toEqual({
        id: expect.any(String),
        via: 'photos',
        state: 'pending',
      });
    });

    it('sends the text, as a new parse, once the server fails the photos', async () => {
      seedMilkDraft({ photoKeys: PHOTOS });
      const create = photosThenText(ReceiptParseStatus.Failed);
      const { result } = render([create.mock]);

      await waitFor(() => expect(create.fired).toHaveLength(2));
      const [photos, text] = create.fired.map(inputOf);
      expect(photos).toEqual(expect.objectContaining({ photos: PHOTOS }));
      expect(text).toEqual(
        expect.objectContaining({ pages: PAGES, id: expect.any(String) }),
      );
      expect(text?.id).not.toBe(photos?.id);
      expect(useReceiptDraftStore.getState().draft?.photoKeys).toBeUndefined();
      expect(result.current.readingStatus).toBe('reading');
    });

    it('sends the text once the daily limit lets it, never the spent photos', async () => {
      seedMilkDraft({ photoKeys: PHOTOS });
      const { result, unmount } = render([overTheLimit(3600)]);
      await waitFor(() => expect(result.current.readingStatus).toBe('limited'));
      const photoParse = useReceiptDraftStore.getState().draft?.serverParse;
      expect(useReceiptDraftStore.getState().draft?.photoKeys).toBeUndefined();
      unmount();

      await act(async () => {
        await jest.advanceTimersByTimeAsync(3_600_000);
      });
      const later = created(ReceiptParseStatus.Pending);
      render([later.mock]);

      await waitFor(() => expect(later.fired).toHaveLength(1));
      const [input] = later.fired.map(inputOf);
      expect(input).toEqual(expect.objectContaining({ pages: PAGES }));
      expect(input?.id).not.toBe(photoParse?.id);
    });

    it('keeps waiting on a slow photo parse, and says it can take a minute', async () => {
      seedMilkDraft({ photoKeys: PHOTOS });
      const create = created(ReceiptParseStatus.Pending);
      const stillReading = recordMock(ReceiptParseDocument, {
        dataFor: vars => ({
          receiptParse: {
            id: String(vars.id),
            status: ReceiptParseStatus.Pending,
            warnings: [],
            receipt: null,
          },
        }),
      });
      const { result } = render([create.mock, stillReading.mock]);
      await waitFor(() => expect(create.fired).toHaveLength(1));
      expect(result.current.slowPhotoRead).toBe(false);

      await waitFor(() => expect(stillReading.fired).toHaveLength(1));
      for (let second = 0; second < 45; second += 1) {
        await act(async () => {
          await jest.advanceTimersByTimeAsync(1000);
        });
      }

      expect(result.current.readingStatus).toBe('reading');
      expect(result.current.slowPhotoRead).toBe(true);
      expect(create.fired).toHaveLength(1);
    });
  });

  it('stops at a limit that names no wait, as when no worker runs', async () => {
    seedMilkDraft();
    const { result } = render([overTheLimit()]);

    await waitFor(() =>
      expect(result.current.readingStatus).toBe('unavailable'),
    );
  });

  it('keeps a parse whose ask never got an answer, to send it again', async () => {
    seedMilkDraft();
    const dropped = created(new NetworkRequestError('Network request failed'));
    const { result } = render([dropped.mock]);

    await waitFor(() => expect(dropped.fired).toHaveLength(1));
    await pollOnce();

    expect(result.current.readingStatus).toBe('reading');
    expect(useReceiptDraftStore.getState().draft?.serverParse).toEqual({
      id: expect.any(String),
      via: 'text',
      state: 'pending',
    });
  });

  it('asks again after a server fault, and reads the receipt then', async () => {
    seedMilkDraft({ purchasedOn: undefined });
    const fault = created(
      new ServerError('Bad Gateway', {
        response: new Response('', { status: 502 }),
        bodyText: '',
      }),
      { maxUsageCount: 1 },
    );
    const create = created(ReceiptParseStatus.Pending);
    const poll = polledTo({
      status: ReceiptParseStatus.Parsed,
      warnings: [],
      receipt: MILK_RECEIPT,
    });
    const { result } = render([fault.mock, create.mock, ...poll.mocks]);

    await waitFor(() => expect(fault.fired).toHaveLength(1));
    expect(useReceiptDraftStore.getState().draft?.serverParse?.state).toBe(
      'pending',
    );
    expect(result.current.readingStatus).toBe('reading');

    await pollOnce();
    await waitFor(() => expect(create.fired).toHaveLength(1));
    expect(create.fired[0]).toEqual({
      input: expect.objectContaining({
        id: useReceiptDraftStore.getState().draft?.serverParse?.id,
      }),
    });
    await pollOnce();
    await pollOnce();
    await waitFor(() =>
      expect(useReceiptDraftStore.getState().draft?.parsedBy).toBe('server'),
    );
  });

  it('stops asking for this visit after three resends, and says so', async () => {
    seedMilkDraft();
    const timedOut = created(new TimeoutError('createReceiptParse', 30_000));
    const { result } = render([timedOut.mock]);

    await waitFor(() => expect(timedOut.fired).toHaveLength(1));
    // Each resend is timed from the answer before it.
    for (const [wait, count] of [
      [2500, 2],
      [5000, 3],
      [10_000, 4],
    ] as const) {
      expect(result.current.readingStatus).toBe('reading');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(wait);
      });
      await waitFor(() => expect(timedOut.fired).toHaveLength(count));
    }
    await waitFor(() =>
      expect(result.current.readingStatus).toBe('retryLater'),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(timedOut.fired).toHaveLength(4);
    expect(useReceiptDraftStore.getState().draft?.serverParse?.state).toBe(
      'pending',
    );
  });

  // "Scan another" keeps the screen, so the next receipt must not inherit the
  // last one's spent resends or a wait still pending for it.
  it('gives a receipt scanned after one that gave up its own resends', async () => {
    seedMilkDraft();
    const timedOut = created(new TimeoutError('createReceiptParse', 30_000));
    const { result } = render([timedOut.mock]);

    await waitFor(() => expect(timedOut.fired).toHaveLength(1));
    for (const [wait, count] of [
      [2500, 2],
      [5000, 3],
      [10_000, 4],
    ] as const) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(wait);
      });
      await waitFor(() => expect(timedOut.fired).toHaveLength(count));
    }
    await waitFor(() =>
      expect(result.current.readingStatus).toBe('retryLater'),
    );

    act(() => {
      seedMilkDraft({ scannedAt: '2026-10-01T10:05:00.000Z' });
    });

    await waitFor(() => expect(timedOut.fired).toHaveLength(5));
    expect(result.current.readingStatus).toBe('reading');
    // Its first resend comes after the first wait again.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2500);
    });
    await waitFor(() => expect(timedOut.fired).toHaveLength(6));
  });

  it.each([
    ['pages', 'tooLong'],
    ['locale', 'unavailable'],
  ])(
    'takes a refusal on %s as final (%s), and never sends it again',
    async (field, status) => {
      seedMilkDraft();
      const refused = recordMock(CreateReceiptParseDocument, {
        data: {
          createReceiptParse: {
            __typename: 'ValidationError',
            code: ErrorCode.ValidationFailed,
            field,
          },
        },
      });
      const { result } = render([refused.mock]);

      await waitFor(() => expect(result.current.readingStatus).toBe(status));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20_000);
      });
      expect(refused.fired).toHaveLength(1);
    },
  );

  it('asks nothing offline, and says the items are read once back online', async () => {
    seedMilkDraft();
    useStore.setState({ isOnline: false });
    const create = created(ReceiptParseStatus.Pending);
    const { result } = render([create.mock]);

    await pollOnce();

    expect(create.fired).toEqual([]);
    expect(result.current.readingStatus).toBe('offline');
  });

  it('sends a parse already asked for again with its own id', async () => {
    seedMilkDraft({
      serverParse: { id: 'parse-1', via: 'text', state: 'pending' },
    });
    const create = created(ReceiptParseStatus.Pending);
    render([create.mock]);

    await waitFor(() => expect(create.fired).toHaveLength(1));
    expect(create.fired[0]).toEqual({
      input: expect.objectContaining({ id: 'parse-1' }),
    });
  });

  it('waits for the scan to finish, and leaves a receipt the phone read alone', async () => {
    seedMilkDraft();
    const create = created(ReceiptParseStatus.Pending);
    render([create.mock], { enabled: false });
    await pollOnce();
    expect(create.fired).toEqual([]);

    seedMilkDraft({ parsed: { lines: [] }, parsedBy: 'device' });
    render([create.mock]);
    await pollOnce();
    expect(create.fired).toEqual([]);
  });
});
