import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  inputOf,
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';
import { Telemetry } from '#/services/telemetry';
import { t } from '#/i18n';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import {
  checkInAnswer,
  seedDraft,
  sentLinesOf,
} from '../../__tests__/helpers/receiptFixtures';
import { CreateReceiptCheckInDocument } from '../useReceiptCheckIn.generated';
import {
  useReceiptCheckIn,
  type CheckInLineToSend,
  type ReceiptToCheckIn,
} from '../useReceiptCheckIn';
import { askForReviewAfterSuccess } from '#/domain/reviewPrompt';

jest.mock('#/domain/reviewPrompt');

const PANTRY_ID = 'pantry-1';

const line = (
  index: number,
  itemName = `Item ${index}`,
): CheckInLineToSend => ({
  index,
  itemName,
  input: {
    clientId: String(index),
    purchaseId: `pur-${index}`,
    pantryItemId: `pi-${index}`,
    item: { id: `item-${index}` },
    amount: { packages: { count: 1 } },
    totalPaid: 1,
  },
});

const receipt = (checkInIds: string[]): ReceiptToCheckIn => ({
  checkInIds,
  pantryId: PANTRY_ID,
  purchasedOn: '2026-10-15',
  storeId: 'store-1',
});

// Every line recorded under its own stack, except those `refuses` names.
const answering = (options?: Parameters<typeof checkInAnswer>[0]) =>
  recordMock(CreateReceiptCheckInDocument, {
    dataFor: checkInAnswer(options),
  });

const pantryRows = (cache: ReturnType<typeof makeCache>) =>
  Object.keys(cache.extract()).filter(key => key.startsWith('PantryItem:pi-'));

beforeEach(() => {
  jest.clearAllMocks();
  useReceiptDraftStore.setState({ draft: null });
  seedDraft();
  useReceiptDraftStore.getState().ensureCheckInIds([0, 1], 1);
});

const checkInIds = () =>
  useReceiptDraftStore.getState().draft?.checkIn?.ids ?? [];

describe('useReceiptCheckIn', () => {
  beforeEach(() => jest.mocked(askForReviewAfterSuccess).mockClear());

  it('shows every line in the pantry before the API answers, and keeps what it recorded', async () => {
    const cache = makeCache();
    const checkIn = answering();
    const { result } = renderHookWithApollo(
      () => useReceiptCheckIn(undefined),
      {
        cache,
        operationMocks: [checkIn.mock],
      },
    );

    let shownBefore: string[] = [];
    let outcome;
    await act(async () => {
      const sending = result.current.checkIn(receipt(checkInIds()), [
        line(0),
        line(1),
      ]);
      shownBefore = pantryRows(cache);
      outcome = await sending;
    });

    expect(shownBefore).toEqual(['PantryItem:pi-0', 'PantryItem:pi-1']);
    expect(pantryRows(cache)).toEqual(['PantryItem:pi-0', 'PantryItem:pi-1']);
    expect(outcome).toEqual({ status: 'recorded', added: [0, 1], failed: [] });
    expect(askForReviewAfterSuccess).toHaveBeenCalledTimes(1);
    expect(useReceiptDraftStore.getState().draft?.added).toEqual([0, 1]);
    const [fired] = checkIn.fired;
    expect(fired?.input).toMatchObject({
      id: checkInIds()[0],
      pantryId: PANTRY_ID,
      storeId: 'store-1',
      purchasedOn: '2026-10-15',
      lines: [{ clientId: '0' }, { clientId: '1' }],
    });
  });

  it('withdraws only the line the API refused, and names it', async () => {
    const cache = makeCache();
    const checkIn = answering({ refuses: sent => sent.clientId === '1' });
    const { result } = renderHookWithApollo(
      () => useReceiptCheckIn(undefined),
      {
        cache,
        operationMocks: [checkIn.mock],
      },
    );

    await act(async () => {
      await result.current.checkIn(receipt(checkInIds()), [
        line(0),
        line(1, 'Cubanelle pepper'),
      ]);
    });

    expect(pantryRows(cache)).toEqual(['PantryItem:pi-0']);
    expect(useReceiptDraftStore.getState().draft?.failed).toEqual({
      1: ErrorCode.ValidationFailed,
    });
    expect(toastService.error).toHaveBeenCalledWith(
      expect.stringContaining('Cubanelle pepper'),
    );
  });

  it("states the one cause every refused line shares, in the reader's language, and records its log id", async () => {
    const checkIn = answering({
      refuses: () => true,
      failure: { code: ErrorCode.ValidationFailed, errorId: 'err-1' },
    });
    const { result } = renderHookWithApollo(
      () => useReceiptCheckIn(undefined),
      { operationMocks: [checkIn.mock] },
    );

    await act(async () => {
      await result.current.checkIn(receipt(checkInIds()), [
        line(0, 'Cubanelle pepper'),
        line(1, ' '),
      ]);
    });

    const cause = errorService.messageForCode(ErrorCode.ValidationFailed, t);
    // The blank name is counted, not listed.
    expect(toastService.error).toHaveBeenCalledWith(
      `Couldn't add 2 lines (Cubanelle pepper): ${cause}`,
    );
    expect(Telemetry.trackEvent).toHaveBeenCalledWith(
      'receipt_check_in_lines_failed',
      expect.objectContaining({
        failed_count: 2,
        failed_codes: ErrorCode.ValidationFailed,
        failed_error_ids: 'err-1,err-1',
      }),
    );
  });

  it('counts refused lines no name survives for', async () => {
    const checkIn = answering({ refuses: () => true });
    const { result } = renderHookWithApollo(
      () => useReceiptCheckIn(undefined),
      { operationMocks: [checkIn.mock] },
    );

    await act(async () => {
      await result.current.checkIn(receipt(checkInIds()), [line(0, '')]);
    });

    expect(toastService.error).toHaveBeenCalledWith(
      expect.stringMatching(/^Couldn't add 1 line/),
    );
  });

  it('withdraws every line when the receipt is refused whole', async () => {
    const cache = makeCache();
    const refused = recordMock(CreateReceiptCheckInDocument, {
      data: {
        createReceiptCheckIn: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useReceiptCheckIn(undefined),
      {
        cache,
        operationMocks: [refused.mock],
      },
    );

    let outcome;
    await act(async () => {
      outcome = await result.current.checkIn(receipt(checkInIds()), [
        line(0),
        line(1),
      ]);
    });

    expect(pantryRows(cache)).toEqual([]);
    expect(outcome).toMatchObject({ status: 'refused' });
    // Back to send again: nothing counts as added.
    expect(askForReviewAfterSuccess).not.toHaveBeenCalled();
    expect(useReceiptDraftStore.getState().draft?.added).toEqual([]);
  });

  it('takes back the sends after one refused whole, unsent, and keeps what landed before it', async () => {
    const cache = makeCache();
    const lines = Array.from({ length: 250 }, (_, index) => line(index));
    useReceiptDraftStore.getState().ensureCheckInIds(
      lines.map(sent => sent.index),
      3,
    );
    const [, refusedId] = checkInIds();
    const checkIn = recordMock(CreateReceiptCheckInDocument, {
      dataFor: (vars): MockDataFor<typeof CreateReceiptCheckInDocument> =>
        inputOf(vars).id === refusedId
          ? {
              createReceiptCheckIn: {
                __typename: 'ForbiddenError',
                code: ErrorCode.Forbidden,
              },
            }
          : checkInAnswer()(vars),
      maxUsageCount: 3,
    });
    const { result } = renderHookWithApollo(
      () => useReceiptCheckIn(undefined),
      { cache, operationMocks: [checkIn.mock] },
    );

    let outcome;
    await act(async () => {
      outcome = await result.current.checkIn(receipt(checkInIds()), lines);
    });

    const range = (from: number, to: number) =>
      Array.from({ length: to - from }, (_, at) => from + at);
    const draft = useReceiptDraftStore.getState().draft;
    expect(outcome).toMatchObject({ status: 'refused' });
    expect(checkIn.fired).toHaveLength(2);
    expect(draft?.added).toEqual(range(0, 100));
    expect(draft?.failed).toEqual(
      Object.fromEntries(
        range(100, 200).map(index => [index, ErrorCode.Forbidden]),
      ),
    );
    expect(pantryRows(cache)).toHaveLength(100);
    expect(cache.extract()['PantryItem:pi-249']).toBeUndefined();
    expect(unconfirmedCreates.has('pi-249')).toBe(false);
    expect(toastService.error).toHaveBeenCalledTimes(1);
  });

  it('re-points a typed item the API matched to one it holds', async () => {
    const cache = makeCache();
    const typed: CheckInLineToSend = {
      ...line(0, 'Cubanelle pepper'),
      input: {
        ...line(0).input,
        item: { inline: { id: 'item-minted', name: 'Cubanelle pepper' } },
      },
    };
    const checkIn = recordMock(CreateReceiptCheckInDocument, {
      data: {
        createReceiptCheckIn: {
          __typename: 'CreateReceiptCheckInPayload',
          results: [
            {
              index: 0,
              success: true,
              failure: null,
              item: { id: 'item-held' },
              pantryItem: { id: 'pi-0', item: { id: 'item-held' } },
              shoppingListItem: null,
            },
          ],
        },
      },
    });
    const { result } = renderHookWithApollo(
      () => useReceiptCheckIn(undefined),
      { cache, operationMocks: [checkIn.mock] },
    );

    let namedBefore: unknown;
    await act(async () => {
      const sending = result.current.checkIn(receipt(checkInIds()), [typed]);
      namedBefore = cache.extract()['PantryItem:pi-0']?.item;
      await sending;
    });

    expect(namedBefore).toEqual({ __ref: 'Item:item-minted' });
    expect(cache.extract()['PantryItem:pi-0']?.item).toEqual({
      __ref: 'Item:item-held',
    });
    expect(cache.extract()['Item:item-minted']).toBeUndefined();
  });

  it('sends a long receipt as consecutive check-ins of at most 100 lines', async () => {
    const lines = Array.from({ length: 130 }, (_, index) => line(index));
    useReceiptDraftStore.getState().ensureCheckInIds(
      lines.map(sent => sent.index),
      2,
    );
    const checkIn = answering();
    const { result } = renderHookWithApollo(
      () => useReceiptCheckIn(undefined),
      {
        operationMocks: [{ ...checkIn.mock, maxUsageCount: 2 }],
      },
    );

    await act(async () => {
      await result.current.checkIn(receipt(checkInIds()), lines);
    });

    expect(checkIn.fired.map(vars => sentLinesOf(vars).length)).toEqual([
      100, 30,
    ]);
    expect(checkIn.fired.map(vars => inputOf(vars).id)).toEqual(checkInIds());
    expect(useReceiptDraftStore.getState().draft?.added).toHaveLength(130);
  });
});
