import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';
import { Telemetry } from '#/services/telemetry';
import { t } from '#/i18n';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { seedDraft } from '../../__tests__/helpers/receiptFixtures';
import { CreateReceiptCheckInDocument } from '../useReceiptCheckIn.generated';
import {
  useReceiptCheckIn,
  type CheckInLineToSend,
  type ReceiptToCheckIn,
} from '../useReceiptCheckIn';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

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

type Lines = { clientId: string; pantryItemId?: string | null }[];

// Every line recorded under its own stack, except those `refused` names.
const answering = (
  refused: readonly number[] = [],
  failure: { code: ErrorCode; errorId: string | null } = {
    code: ErrorCode.ValidationFailed,
    errorId: null,
  },
) =>
  recordMock(CreateReceiptCheckInDocument, {
    dataFor: (vars): MockDataFor<typeof CreateReceiptCheckInDocument> => {
      const lines = (vars.input as { lines: Lines }).lines;
      return {
        createReceiptCheckIn: {
          __typename: 'CreateReceiptCheckInPayload',
          results: lines.map((sent, index) =>
            refused.includes(index)
              ? {
                  __typename: 'ReceiptCheckInLineResult',
                  index,
                  clientId: sent.clientId,
                  success: false,
                  alreadyRecorded: false,
                  failure: { __typename: 'BatchElementFailure', ...failure },
                  item: null,
                  purchase: null,
                  pantryItem: null,
                  shoppingListItem: null,
                }
              : {
                  __typename: 'ReceiptCheckInLineResult',
                  index,
                  clientId: sent.clientId,
                  success: true,
                  alreadyRecorded: false,
                  failure: null,
                  pantryItem: {
                    __typename: 'PantryItem',
                    id: String(sent.pantryItemId),
                  },
                  shoppingListItem: null,
                },
          ),
        },
      };
    },
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
    const checkIn = answering([1]);
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
    const checkIn = answering([0, 1], {
      code: ErrorCode.ValidationFailed,
      errorId: 'err-1',
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
    const checkIn = answering([0]);
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
          message: 'No',
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
    expect(useReceiptDraftStore.getState().draft?.added).toEqual([]);
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
              __typename: 'ReceiptCheckInLineResult',
              index: 0,
              clientId: '0',
              success: true,
              alreadyRecorded: false,
              failure: null,
              item: { __typename: 'Item', id: 'item-held' },
              pantryItem: {
                __typename: 'PantryItem',
                id: 'pi-0',
                item: { __typename: 'Item', id: 'item-held' },
              },
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

    const sent = checkIn.fired.map(
      fired => fired.input as { id: string; lines: Lines },
    );
    expect(sent.map(input => input.lines.length)).toEqual([100, 30]);
    expect(sent.map(input => input.id)).toEqual(checkInIds());
    expect(useReceiptDraftStore.getState().draft?.added).toHaveLength(130);
  });
});
