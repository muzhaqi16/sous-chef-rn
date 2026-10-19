import { printedTimeOf, purchaseMomentOf } from '../receiptDate';

/** The local wall clock of an instant: what the phone's own zone reads. */
const localClock = (iso: string) => {
  const at = new Date(iso);
  return [
    at.getFullYear(),
    at.getMonth() + 1,
    at.getDate(),
    at.getHours(),
    at.getMinutes(),
  ];
};

describe('purchaseMomentOf', () => {
  it("places the receipt's printed time on its day, on the phone's clock", () => {
    expect(localClock(purchaseMomentOf('2026-10-17', '18:42'))).toEqual([
      2026, 10, 17, 18, 42,
    ]);
  });

  it.each([
    ['no time was read', undefined],
    ['the time is a misread', '24:00'],
  ])('takes noon that day when %s', (_name, time) => {
    expect(localClock(purchaseMomentOf('2026-10-17', time))).toEqual([
      2026, 10, 17, 12, 0,
    ]);
  });
});

describe('printedTimeOf', () => {
  it.each([
    ['00:05', '00:05'],
    ['23:59', '23:59'],
    ['24:00', undefined],
    ['9:15', undefined],
    [null, undefined],
  ])('reads %s as %s', (value, time) => {
    expect(printedTimeOf(value)).toBe(time);
  });
});
