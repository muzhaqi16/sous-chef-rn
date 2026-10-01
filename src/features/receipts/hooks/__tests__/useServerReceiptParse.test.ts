'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import { GraphQLError } from 'graphql';
import {
  ReceiptLineKind,
  ReceiptParseStatus,
  ReceiptParseWarningCode,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import {
  CreateReceiptParseDocument,
  ReceiptParseDocument,
} from '../useServerReceiptParse.generated';
import { useServerReceiptParse } from '../useServerReceiptParse';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#/services/errorService');

const PAGES = ['WALMART\nGV WHOLE MILK 007874235186 F  3.48 N\nTOTAL  3.48'];

const seedDraft = (extra = {}) =>
  useReceiptDraftStore.setState({
    draft: {
      pages: PAGES,
      scannedAt: '2026-10-01T10:00:00.000Z',
      purchasedOn: '2026-09-30',
      ...extra,
    },
  });

const created = (status: ReceiptParseStatus) =>
  recordMock(CreateReceiptParseDocument, {
    dataFor: (vars): MockDataFor<typeof CreateReceiptParseDocument> => {
      const input =
        typeof vars.input === 'object' && vars.input !== null
          ? (vars.input as { id: string })
          : { id: '' };
      return {
        createReceiptParse: {
          __typename: 'CreateReceiptParsePayload',
          receiptParse: { id: input.id, status, warnings: [], receipt: null },
        },
      };
    },
  });

const MILK_RECEIPT = {
  merchant: { name: 'WALMART' },
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
    seedDraft();
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
    // The day the phone read before redaction stands.
    expect(draft?.purchasedOn).toBe('2026-09-30');
    expect(draft?.serverParse).toBeUndefined();
    expect(result.current.readingStatus).toBe('none');
  });

  it('keeps the text when no receipt worker runs, and asks nothing more', async () => {
    seedDraft();
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
    seedDraft();
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

  it('waits out the daily limit, then asks again on a later visit', async () => {
    seedDraft();
    const { result, unmount } = render([overTheLimit(3600)]);

    await waitFor(() => expect(result.current.readingStatus).toBe('limited'));
    const asked = useReceiptDraftStore.getState().draft?.serverParse;
    expect(asked).toEqual({
      id: expect.any(String),
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

  it('stops at a limit that names no wait, as when no worker runs', async () => {
    seedDraft();
    const { result } = render([overTheLimit()]);

    await waitFor(() =>
      expect(result.current.readingStatus).toBe('unavailable'),
    );
  });

  it('keeps a parse whose ask never got an answer, to send it again', async () => {
    seedDraft();
    const dropped = recordMock(CreateReceiptParseDocument, {
      error: new NetworkRequestError('Network request failed'),
    });
    const { result } = render([dropped.mock]);

    await waitFor(() => expect(dropped.fired).toHaveLength(1));
    await pollOnce();

    expect(result.current.readingStatus).toBe('reading');
    expect(useReceiptDraftStore.getState().draft?.serverParse).toEqual({
      id: expect.any(String),
      state: 'pending',
    });
  });

  it('asks nothing offline, and says the items are read once back online', async () => {
    seedDraft();
    useStore.setState({ isOnline: false });
    const create = created(ReceiptParseStatus.Pending);
    const { result } = render([create.mock]);

    await pollOnce();

    expect(create.fired).toEqual([]);
    expect(result.current.readingStatus).toBe('offline');
  });

  it('sends a parse already asked for again with its own id', async () => {
    seedDraft({ serverParse: { id: 'parse-1', state: 'pending' } });
    const create = created(ReceiptParseStatus.Pending);
    render([create.mock]);

    await waitFor(() => expect(create.fired).toHaveLength(1));
    expect(create.fired[0]).toEqual({
      input: expect.objectContaining({ id: 'parse-1' }),
    });
  });

  it('waits for the scan to finish, and leaves a receipt the phone read alone', async () => {
    seedDraft();
    const create = created(ReceiptParseStatus.Pending);
    render([create.mock], { enabled: false });
    await pollOnce();
    expect(create.fired).toEqual([]);

    seedDraft({ parsed: { lines: [] }, parsedBy: 'device' });
    render([create.mock]);
    await pollOnce();
    expect(create.fired).toEqual([]);
  });
});
