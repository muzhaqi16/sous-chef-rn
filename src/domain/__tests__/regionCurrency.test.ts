// Region, never language.
//
// The app ships four languages against eleven currencies, so language cannot
// choose one: Spanish spans USD and EUR, English spans five. Region can, and
// the answer has to be right the FIRST time — a cost keeps the currency it was
// recorded in, and changing the preference later does not re-denominate it.

import {
  deviceRegion,
  deviceRegionCurrency,
  isUnchosenCurrency,
} from '#/domain/regionCurrency';

const withLocale = (locale: string | null, run: () => void) => {
  const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () =>
      ({
        resolvedOptions: () => {
          if (locale === null) throw new Error('no Intl data');
          return { locale } as Intl.ResolvedDateTimeFormatOptions;
        },
      } as Intl.DateTimeFormat),
  );
  try {
    run();
  } finally {
    spy.mockRestore();
  }
};

describe('deviceRegion', () => {
  it.each([
    ['en-US', 'US'],
    ['sq-AL', 'AL'],
    ['it-IT', 'IT'],
    ['zh-Hans-CN', 'CN'],
    ['en-GB', 'GB'],
  ])('reads the region out of %s', (locale, expected) => {
    withLocale(locale, () => expect(deviceRegion()).toBe(expected));
  });

  it('is absent when the locale carries no region', () => {
    withLocale('sq', () => expect(deviceRegion()).toBeNull());
  });

  it('is absent when the platform has no Intl data', () => {
    withLocale(null, () => expect(deviceRegion()).toBeNull());
  });
});

describe('deviceRegionCurrency', () => {
  it.each([
    ['en-US', 'USD'],
    ['sq-AL', 'LEK'],
    ['it-IT', 'EUR'],
    ['de-AT', 'EUR'],
    ['en-GB', 'GBP'],
    ['en-AU', 'AUD'],
    ['fr-CA', 'CAD'],
    ['de-CH', 'CHF'],
    ['zh-Hans-CN', 'CNY'],
    ['ja-JP', 'JPY'],
    ['sv-SE', 'SEK'],
    ['en-NZ', 'NZD'],
  ])('denominates %s as %s', (locale, expected) => {
    withLocale(locale, () => expect(deviceRegionCurrency()).toBe(expected));
  });

  it('yields nothing for a region whose currency the API does not offer', () => {
    // Mexico uses MXN, which is not in the option list. Better to leave the
    // account on the server's default than to move it to a nearby currency.
    withLocale('es-MX', () => expect(deviceRegionCurrency()).toBeNull());
  });

  it('yields nothing when the region is unknown', () => {
    withLocale('sq', () => expect(deviceRegionCurrency()).toBeNull());
  });
});

describe('isUnchosenCurrency', () => {
  it('treats the server default and an absent value as unchosen', () => {
    expect(isUnchosenCurrency('USD')).toBe(true);
    expect(isUnchosenCurrency(null)).toBe(true);
    expect(isUnchosenCurrency(undefined)).toBe(true);
  });

  it('treats anything else as the user having chosen', () => {
    expect(isUnchosenCurrency('EUR')).toBe(false);
    expect(isUnchosenCurrency('LEK')).toBe(false);
  });
});
