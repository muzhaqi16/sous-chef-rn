import type { ReceiptMatchState } from '../../hooks/useReceiptMatches';
import { storeOfferOf } from '../storeOfferOf';

const API = { id: 'store-own', name: 'Kroger' };
const DEVICE = { id: 'store-label', name: 'Kroger' };
const PICKED = { id: 'store-27', name: 'Kroger #412' };

describe('storeOfferOf', () => {
  it.each<[ReceiptMatchState, typeof PICKED | null, typeof API | null]>([
    ['done', null, API],
    ['failed', null, DEVICE],
    ['matching', null, null],
    ['done', PICKED, null],
    ['failed', PICKED, null],
    ['matching', PICKED, null],
  ])(
    'matching %s, with the store %j, offers %j',
    (matchState, store, offer) => {
      expect(
        storeOfferOf({ parseId: 'parse-1', store }, matchState, {
          api: API,
          device: DEVICE,
        }),
      ).toEqual(offer);
    },
  );

  // The API answers that none of the household's would be located.
  it("offers none of the device's once the API answers none", () => {
    expect(
      storeOfferOf({ parseId: 'parse-1', store: null }, 'done', {
        api: null,
        device: DEVICE,
      }),
    ).toBeNull();
  });

  it('offers none without a server parse to locate it from', () => {
    expect(
      storeOfferOf({ parseId: undefined, store: null }, 'done', {
        api: API,
        device: DEVICE,
      }),
    ).toBeNull();
  });
});
