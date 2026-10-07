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

    it('waits out the daily limit with the text, the photos spent', () => {
      seedDraft({ photoKeys: PHOTOS });
      actions().askServerParse('p1', 'photos');
      actions().settleServerParse('p1', {
        retryAt: '2026-10-08T00:00:00.000Z',
      });

      expect(draft()?.photoKeys).toBeUndefined();
      expect(draft()?.serverParse).toEqual({
        id: 'p1',
        via: 'photos',
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
  });
});
