import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { useReceiptDraftStore } from '../receiptDraftStore';
import { seedDraft } from '../../__tests__/helpers/receiptFixtures';

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
      actions().recordPhotoKeys('2026-10-01T10:00:00.000Z', PHOTOS);

      expect(draft()?.photoKeys).toEqual(PHOTOS);
    });

    it('leaves a newer draft alone', () => {
      seedDraft({ scannedAt: '2026-10-07T12:00:00.000Z' });
      actions().recordPhotoKeys('2026-10-07T11:00:00.000Z', PHOTOS);

      expect(draft()?.photoKeys).toBeUndefined();
    });

    it('leaves a draft already asked about alone', () => {
      seedDraft({ serverParse: { id: 'p1', via: 'text', state: 'pending' } });
      actions().recordPhotoKeys('2026-10-01T10:00:00.000Z', PHOTOS);

      expect(draft()?.photoKeys).toBeUndefined();
    });
  });

  describe('settling a photo parse that read nothing', () => {
    it.each(['failed', 'unavailable', 'unreadable', 'tooLong'] as const)(
      'drops the spent photos of a receipt with text, so the text is asked for next (%s)',
      state => {
        seedDraft({ photoKeys: PHOTOS });
        actions().askServerParse('p1', 'photos');
        actions().settleServerParse('p1', state);

        expect(draft()?.photoKeys).toBeUndefined();
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

    it('ignores the answer to a check-in the receipt never sent', () => {
      sending();
      actions().settleCheckIn('another-check-in', [
        { index: 0, success: false, failure: { code: ErrorCode.Forbidden } },
      ]);

      expect(draft()?.added).toEqual([0, 1]);
      expect(draft()?.checkIn?.state).toBe('sending');
    });
  });

  describe('a draft saved by an older build', () => {
    const migrate = (persisted: unknown) =>
      useReceiptDraftStore.persist.getOptions().migrate?.(persisted, 1);

    it('reads a parse of a photo draft as one of its photos', () => {
      expect(
        migrate({
          draft: {
            pages: [],
            photoKeys: PHOTOS,
            scannedAt: '2026-10-01T10:00:00.000Z',
            serverParse: { id: 'p1', state: 'pending' },
          },
        }),
      ).toEqual({
        draft: {
          pages: [],
          photoKeys: PHOTOS,
          scannedAt: '2026-10-01T10:00:00.000Z',
          serverParse: { id: 'p1', via: 'photos', state: 'pending' },
        },
      });
    });

    it('reads a parse of a text draft as one of its text', () => {
      expect(
        migrate({
          draft: {
            pages: ['RECEIPT'],
            scannedAt: '2026-10-01T10:00:00.000Z',
            serverParse: {
              id: 'p1',
              state: 'limited',
              retryAt: '2026-10-02T00:00:00.000Z',
            },
          },
        }),
      ).toEqual({
        draft: {
          pages: ['RECEIPT'],
          scannedAt: '2026-10-01T10:00:00.000Z',
          serverParse: {
            id: 'p1',
            via: 'text',
            state: 'limited',
            retryAt: '2026-10-02T00:00:00.000Z',
          },
        },
      });
    });

    it('keeps a draft that was never asked about as it was', () => {
      const persisted = {
        draft: { pages: ['RECEIPT'], scannedAt: '2026-10-01T10:00:00.000Z' },
      };
      expect(migrate(persisted)).toEqual(persisted);
    });

    it('reads a version 2 draft with its lines, picks and added lines as they were', () => {
      const persisted = {
        draft: {
          pages: ['RECEIPT'],
          scannedAt: '2026-10-01T10:00:00.000Z',
          choices: { 0: null },
          added: [1],
        },
      };
      expect(
        useReceiptDraftStore.persist.getOptions().migrate?.(persisted, 2),
      ).toEqual(persisted);
    });
  });
});
