import {
  getDeviceDateOrder,
  getDeviceDecimalSeparator,
  resetDeviceLocaleCache,
} from '../deviceLocale';

const realNumberFormat = Intl.NumberFormat;

function setNumberFormat(impl: typeof Intl.NumberFormat) {
  (Intl as { NumberFormat: typeof Intl.NumberFormat }).NumberFormat = impl;
}

/**
 * Stand the device locale up for one case. The module resolves the locale by
 * passing `undefined` — the platform default — so the only way to observe a
 * different device from here is to substitute what that default resolves to.
 */
function onLocale(locale: string) {
  resetDeviceLocaleCache();
  setNumberFormat(function NumberFormatShim(
    _requested?: unknown,
    options?: Intl.NumberFormatOptions,
  ) {
    return new realNumberFormat(locale, options);
  } as unknown as typeof Intl.NumberFormat);
}

/** Simulate a build with no usable Intl at all. */
function withoutIntl() {
  resetDeviceLocaleCache();
  setNumberFormat((() => {
    throw new Error('Intl.NumberFormat is not available');
  }) as unknown as typeof Intl.NumberFormat);
}

const realDateTimeFormat = Intl.DateTimeFormat;

function setDateTimeFormat(impl: typeof Intl.DateTimeFormat) {
  (Intl as { DateTimeFormat: typeof Intl.DateTimeFormat }).DateTimeFormat =
    impl;
}

/** As {@link onLocale}, for the device's date conventions. */
function onDateLocale(locale: string) {
  resetDeviceLocaleCache();
  setDateTimeFormat(function DateTimeFormatShim(
    _requested?: unknown,
    options?: Intl.DateTimeFormatOptions,
  ) {
    return new realDateTimeFormat(locale, options);
  } as unknown as typeof Intl.DateTimeFormat);
}

afterEach(() => {
  setNumberFormat(realNumberFormat);
  setDateTimeFormat(realDateTimeFormat);
  resetDeviceLocaleCache();
});

describe('getDeviceDecimalSeparator', () => {
  it.each([
    ['en-US', '.'],
    ['en-GB', '.'],
    ['es-ES', ','],
    ['it-IT', ','],
    ['de-DE', ','],
    ['fr-FR', ','],
  ])('%s uses %s', (locale, expected) => {
    onLocale(locale);
    expect(getDeviceDecimalSeparator()).toBe(expected);
  });

  it('falls back to a period when Intl is unavailable', () => {
    withoutIntl();
    expect(getDeviceDecimalSeparator()).toBe('.');
  });

  it('memoizes, since the device locale cannot change while running', () => {
    onLocale('es-ES');
    expect(getDeviceDecimalSeparator()).toBe(',');

    // A later locale change is not observed without an explicit reset — which
    // is the point: this must not re-resolve on every keystroke.
    setNumberFormat(realNumberFormat);
    expect(getDeviceDecimalSeparator()).toBe(',');
  });
});

describe('getDeviceDateOrder', () => {
  it.each([
    ['en-US', 'monthFirst'],
    ['en-GB', 'dayFirst'],
    ['es-ES', 'dayFirst'],
    ['it-IT', 'dayFirst'],
    ['sq-AL', 'dayFirst'],
    ['de-DE', 'dayFirst'],
  ])('%s writes the date %s', (locale, expected) => {
    onDateLocale(locale);
    expect(getDeviceDateOrder()).toBe(expected);
  });

  it('falls back to month-first when Intl is unavailable', () => {
    resetDeviceLocaleCache();
    setDateTimeFormat((() => {
      throw new Error('Intl.DateTimeFormat is not available');
    }) as unknown as typeof Intl.DateTimeFormat);
    expect(getDeviceDateOrder()).toBe('monthFirst');
  });
});
