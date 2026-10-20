import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { useReceiptDraftStore } from '../receiptDraftStore';
import {
  parsedReceipt,
  seedDraft,
} from '../../__tests__/helpers/receiptFixtures';

const PHOTOS = ['receipt-photos/u1/p1.jpg'];
const actions = () => useReceiptDraftStore.getState();
const draft = () => useReceiptDraftStore.getState().draft;

beforeEach(() => {
  useReceiptDraftStore.setState({ draft: null });
});

describe('receiptDraftStore', () => {
  describe('recordPhotoKeys', () => {
    it('keeps the photos of a draft nothing has asked about yet', () => {
      seedDraft();
      actions().recordPhotoKeys('2026-10-01T10:00:00.000Z', PHOTOS, false);

      expect(draft()?.photoKeys).toEqual(PHOTOS);
      expect(draft()?.photosMasked).toBeUndefined();
    });

    it('records that the photos were masked', () => {
      seedDraft();
      actions().recordPhotoKeys('2026-10-01T10:00:00.000Z', PHOTOS, true);

      expect(draft()?.photosMasked).toBe(true);
    });

    it('leaves a newer draft alone', () => {
      seedDraft({ scannedAt: '2026-10-07T12:00:00.000Z' });
      actions().recordPhotoKeys('2026-10-07T11:00:00.000Z', PHOTOS, false);

      expect(draft()?.photoKeys).toBeUndefined();
    });

    it('leaves a draft already asked about alone', () => {
      seedDraft({ serverParse: { id: 'p1', via: 'text', state: 'pending' } });
      actions().recordPhotoKeys('2026-10-01T10:00:00.000Z', PHOTOS, false);

      expect(draft()?.photoKeys).toBeUndefined();
    });
  });

  describe('settling a photo parse that read nothing', () => {
    it.each(['failed', 'unavailable', 'unreadable', 'tooLong'] as const)(
      'drops the spent photos of a receipt with text, so the text is asked for next (%s)',
      state => {
        seedDraft({ photoKeys: PHOTOS, photosMasked: true });
        actions().askServerParse('p1', 'photos');
        actions().settleServerParse('p1', state);

        expect(draft()?.photoKeys).toBeUndefined();
        expect(draft()?.photosMasked).toBeUndefined();
        expect(draft()?.serverParse).toBeUndefined();
        expect(draft()?.pages).toEqual(['RECEIPT']);
      },
    );

    it('keeps the verdict of a receipt that has only its photos', () => {
      seedDraft({ pages: [], photoKeys: PHOTOS });
      actions().askServerParse('p1', 'photos');
      actions().settleServerParse('p1', 'failed');

      expect(draft()?.photoKeys).toEqual(PHOTOS);
      expect(draft()?.serverParse).toEqual({
        id: 'p1',
        via: 'photos',
        state: 'failed',
      });
    });

    it('reads the text at once when a limit refuses the photos', () => {
      seedDraft({ photoKeys: PHOTOS });
      actions().askServerParse('p1', 'photos');
      actions().settleServerParse('p1', {
        retryAt: '2026-10-08T00:00:00.000Z',
      });

      expect(draft()?.photoKeys).toBeUndefined();
      expect(draft()?.serverParse).toBeUndefined();
    });

    it('waits out a limit on a text parse', () => {
      seedDraft();
      actions().askServerParse('p1', 'text');
      actions().settleServerParse('p1', {
        retryAt: '2026-10-08T00:00:00.000Z',
      });

      expect(draft()?.serverParse).toEqual({
        id: 'p1',
        via: 'text',
        state: 'limited',
        retryAt: '2026-10-08T00:00:00.000Z',
      });
    });

    it('keeps the photos of a text parse that read nothing', () => {
      seedDraft({ photoKeys: PHOTOS });
      actions().askServerParse('p1', 'text');
      actions().settleServerParse('p1', 'failed');

      expect(draft()?.photoKeys).toEqual(PHOTOS);
      expect(draft()?.serverParse?.state).toBe('failed');
    });
  });

  describe('settling a parse that read the receipt', () => {
    const settleRead = (read: {
      purchasedOn?: string;
      purchaseTime?: string;
    }) => {
      actions().askServerParse('p1', 'text');
      actions().settleServerParse('p1', { parsed: parsedReceipt([]), ...read });
    };

    it('takes the day and time the server read', () => {
      seedDraft();
      settleRead({ purchasedOn: '2026-09-30', purchaseTime: '18:42' });

      expect(draft()).toMatchObject({
        purchasedOn: '2026-09-30',
        purchaseTime: '18:42',
      });
    });

    // The phone reads the day before redaction cuts it; a time is only ever
    // of the day it was printed with.
    it("keeps the phone's day, joined by the server's time of that same day", () => {
      seedDraft({ purchasedOn: '2026-09-30' });
      settleRead({ purchasedOn: '2026-09-30', purchaseTime: '18:42' });

      expect(draft()?.purchaseTime).toBe('18:42');
    });

    it("takes no time from a reading of another day than the phone's", () => {
      seedDraft({ purchasedOn: '2026-09-30' });
      settleRead({ purchasedOn: '2026-09-29', purchaseTime: '18:42' });

      expect(draft()?.purchasedOn).toBe('2026-09-30');
      expect(draft()?.purchaseTime).toBeUndefined();
    });
  });

  it('keeps the time when the user sets another day', () => {
    seedDraft({ purchasedOn: '2026-09-30', purchaseTime: '18:42' });
    actions().setPurchasedOn('2026-09-29');

    expect(draft()).toMatchObject({
      purchasedOn: '2026-09-29',
      purchaseTime: '18:42',
    });
  });

  describe('the check-in ids', () => {
    it("mints a line's ids once and keeps them on every later confirm", () => {
      seedDraft();
      actions().ensureCheckInIds([0, 1], 1);
      const first = draft()?.checkIn;
      actions().ensureCheckInIds([0, 1, 2], 1);
      const second = draft()?.checkIn;

      expect(first?.ids).toHaveLength(1);
      expect(second?.ids).toEqual(first?.ids);
      expect(second?.lines[0]).toEqual(first?.lines[0]);
      expect(second?.lines[1]).toEqual(first?.lines[1]);
      expect(second?.lines[2]?.purchaseId).toEqual(expect.any(String));
      expect(second?.lines[2]?.purchaseId).not.toBe(
        second?.lines[2]?.pantryItemId,
      );
    });

    it('keeps the ids a rehydrated draft holds', async () => {
      seedDraft();
      actions().ensureCheckInIds([0], 1);
      const minted = draft()?.checkIn;

      await useReceiptDraftStore.persist.rehydrate();
      actions().ensureCheckInIds([0], 1);

      expect(draft()?.checkIn?.ids).toEqual(minted?.ids);
      expect(draft()?.checkIn?.lines[0]).toEqual(minted?.lines[0]);
    });

    it('adds a check-in id per send a long receipt needs', () => {
      seedDraft();
      actions().ensureCheckInIds([0], 1);
      const [firstId] = draft()?.checkIn?.ids ?? [];
      actions().ensureCheckInIds([0], 2);

      expect(draft()?.checkIn?.ids).toHaveLength(2);
      expect(draft()?.checkIn?.ids[0]).toBe(firstId);
    });

    it("replaces a check-in id another user holds, keeping its lines' ids", () => {
      seedDraft();
      actions().ensureCheckInIds([0], 1);
      const before = draft()?.checkIn;
      const [held = ''] = before?.ids ?? [];
      actions().remintCheckInId(held);

      expect(draft()?.checkIn?.ids[0]).not.toBe(held);
      expect(draft()?.checkIn?.lines[0]).toEqual(before?.lines[0]);
    });
  });

  describe("a line's outcome", () => {
    it("clears a line's failure once it is added", () => {
      seedDraft({
        failed: { 0: ErrorCode.ValidationFailed, 1: ErrorCode.Forbidden },
      });
      actions().markAdded([0]);

      expect(draft()?.added).toEqual([0]);
      expect(draft()?.failed).toEqual({ 1: ErrorCode.Forbidden });
    });
  });

  describe('closing the review', () => {
    const sending = () => {
      seedDraft();
      actions().ensureCheckInIds([0, 1], 1);
      actions().setCheckInState('sending');
      actions().markAdded([0, 1]);
      return draft()?.checkIn?.ids[0] ?? '';
    };

    it('forgets a receipt that has landed', () => {
      seedDraft();
      actions().markAdded([0]);
      actions().closeReceipt();

      expect(draft()).toBeNull();
    });

    it('keeps a receipt still landing, and forgets it once every line has', () => {
      const checkInId = sending();
      actions().closeReceipt();
      expect(draft()?.checkIn?.closed).toBe(true);

      actions().settleCheckIn(checkInId, [
        { index: 0, success: true },
        { index: 1, success: true },
      ]);

      expect(draft()).toBeNull();
    });

    it('keeps a closed receipt with a refused line for its retry', () => {
      const checkInId = sending();
      actions().closeReceipt();

      actions().settleCheckIn(checkInId, [
        { index: 0, success: true },
        {
          index: 1,
          success: false,
          failure: { code: ErrorCode.ValidationFailed },
        },
      ]);

      expect(draft()?.added).toEqual([0]);
      expect(draft()?.failed).toEqual({ 1: ErrorCode.ValidationFailed });
      // Closing it again keeps it while the line waits for its retry.
      actions().closeReceipt();
      expect(draft()?.failed).toEqual({ 1: ErrorCode.ValidationFailed });
    });

    it.each([
      ['a code this build does not know', { code: 'A_NEWER_CODE' }],
      ['no code', null],
    ])(
      'keeps a closed receipt whose line was refused with %s',
      (_case, failure) => {
        const checkInId = sending();
        actions().closeReceipt();

        actions().settleCheckIn(checkInId, [
          { index: 0, success: true },
          { index: 1, success: false, failure },
        ]);

        expect(draft()?.added).toEqual([0]);
        expect(draft()?.failed).toEqual({ 1: null });
      },
    );

    it('ignores the answer to a check-in the receipt never sent', () => {
      sending();
      actions().settleCheckIn('another-check-in', [
        { index: 0, success: false, failure: { code: ErrorCode.Forbidden } },
      ]);

      expect(draft()?.added).toEqual([0, 1]);
      expect(draft()?.checkIn?.state).toBe('sending');
    });
  });
});
