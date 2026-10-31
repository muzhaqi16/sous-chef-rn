import { InMemoryCache } from '@apollo/client';
import { useReceiptDraftStore } from '../../store/receiptDraftStore';
import { seedDraft } from '../../__tests__/helpers/receiptFixtures';
import { forgetReceipt } from '../../utils/forgetReceipt';
import {
  reconcileReceiptCheckInReplay,
  refuseReceiptCheckIn,
} from '../receiptCheckIn';

jest.mock('../../utils/forgetReceipt');

const cache = new InMemoryCache();

const INPUT = {
  id: 'checkin-1',
  pantryId: 'pantry-1',
  lines: [
    { clientId: '0', pantryItemId: 'pi-0' },
    { clientId: '1', pantryItemId: 'pi-1', shoppingListItemId: 'line-eggs' },
    { clientId: '2', pantryItemId: 'pi-2' },
    { clientId: '3' },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('a queued check-in', () => {
  const data = {
    createReceiptCheckIn: {
      __typename: 'CreateReceiptCheckInPayload',
      results: [
        { index: 0, success: true, pantryItem: { id: 'held-stack' } },
        {
          index: 2,
          success: false,
          failure: { code: 'VALIDATION_FAILED' },
          pantryItem: null,
        },
      ],
    },
  };

  beforeEach(() => {
    useReceiptDraftStore.setState({ draft: null });
    seedDraft();
    useReceiptDraftStore.getState().ensureCheckInIds([0, 2], 1);
  });

  const queuedInput = () => ({
    ...INPUT,
    id: useReceiptDraftStore.getState().draft?.checkIn?.ids[0],
  });

  it('moves the writes behind it to a merged stack', () => {
    const adopt = jest.fn();
    reconcileReceiptCheckInReplay(cache, { input: queuedInput() }, data, adopt);

    expect(adopt).toHaveBeenCalledTimes(1);
    expect(adopt).toHaveBeenCalledWith({
      mintedId: 'pi-0',
      survivingId: 'held-stack',
      version: undefined,
    });
  });

  it('tells the saved receipt which lines landed', () => {
    reconcileReceiptCheckInReplay(cache, { input: queuedInput() }, data);

    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.added).toEqual([0]);
    expect(draft?.failed).toEqual({ 2: 'VALIDATION_FAILED' });
    expect(draft?.checkIn?.state).toBe('idle');
  });

  it('settles the receipt lines it sent, not their places in the send', () => {
    useReceiptDraftStore.getState().ensureCheckInIds([3, 7, 9], 1);
    const lines = [3, 7, 9].map(index => ({
      clientId: String(index),
      pantryItemId: `pi-${index}`,
    }));

    reconcileReceiptCheckInReplay(
      cache,
      { input: { ...queuedInput(), lines } },
      {
        createReceiptCheckIn: {
          __typename: 'CreateReceiptCheckInPayload',
          results: [
            { index: 0, success: true, pantryItem: { id: 'pi-3' } },
            {
              index: 1,
              success: false,
              failure: { code: 'VALIDATION_FAILED' },
            },
            { index: 2, success: true, pantryItem: { id: 'pi-9' } },
          ],
        },
      },
    );

    const draft = useReceiptDraftStore.getState().draft;
    expect(draft?.added).toEqual([3, 9]);
    expect(draft?.failed).toEqual({ 7: 'VALIDATION_FAILED' });
  });

  it('ends a receipt whose review closed, and forgets its lookups', () => {
    useReceiptDraftStore.setState({ draft: null });
    seedDraft({ parseId: 'parse-1' });
    const store = useReceiptDraftStore.getState();
    store.ensureCheckInIds([0], 1);
    store.setCheckInState('queued');
    store.closeReceipt();

    reconcileReceiptCheckInReplay(
      cache,
      { input: { ...queuedInput(), lines: [INPUT.lines[0]] } },
      {
        createReceiptCheckIn: {
          __typename: 'CreateReceiptCheckInPayload',
          results: [{ index: 0, success: true, pantryItem: { id: 'pi-0' } }],
        },
      },
    );

    expect(useReceiptDraftStore.getState().draft).toBeNull();
    expect(forgetReceipt).toHaveBeenCalledWith(cache, 'parse-1');
  });

  it('leaves a newer receipt alone', () => {
    reconcileReceiptCheckInReplay(
      cache,
      { input: { ...INPUT, id: 'an-older-check-in' } },
      data,
    );

    expect(useReceiptDraftStore.getState().draft?.added).toBeUndefined();
  });

  it('puts the lines of a check-in refused for good back as failed, on its own receipt', () => {
    useReceiptDraftStore.getState().markAdded([0, 1, 2, 3]);
    useReceiptDraftStore.getState().setCheckInState('queued');

    refuseReceiptCheckIn(cache, { input: queuedInput() });
    const once = useReceiptDraftStore.getState().draft;
    refuseReceiptCheckIn(cache, { input: queuedInput() });

    expect(once?.added).toEqual([]);
    expect(once?.failed).toEqual({ 0: null, 1: null, 2: null, 3: null });
    expect(once?.checkIn?.state).toBe('idle');
    expect(useReceiptDraftStore.getState().draft).toEqual(once);
  });

  it('leaves a receipt holding another check-in alone when one is refused for good', () => {
    useReceiptDraftStore.getState().markAdded([0]);
    useReceiptDraftStore.getState().setCheckInState('sending');
    const before = useReceiptDraftStore.getState().draft;

    refuseReceiptCheckIn(cache, {
      input: { ...INPUT, id: 'an-older-check-in' },
    });

    expect(useReceiptDraftStore.getState().draft).toEqual(before);
  });
});
