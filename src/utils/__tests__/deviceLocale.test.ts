import {
  deviceLanguage,
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

afterEach(() => {
  setNumberFormat(realNumberFormat);
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

describe('deviceLanguage', () => {
  const SHIPPED = ['en', 'it', 'es', 'sq'] as const;
  const realNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );

  /** The device as the app reads it: `navigator.language`, else `Intl`. */
  function onDevice(navigatorLanguage: string | null, intlLocale?: string) {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value:
        navigatorLanguage === null
          ? undefined
          : { language: navigatorLanguage },
    });
    if (intlLocale !== undefined) {
      jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
        () =>
          ({
            resolvedOptions: () => {
              if (intlLocale === 'throws') throw new Error('no Intl data');
              return {
                locale: intlLocale,
              } as Intl.ResolvedDateTimeFormatOptions;
            },
          } as Intl.DateTimeFormat),
      );
    }
  }

  afterEach(() => {
    jest.restoreAllMocks();
    if (realNavigator) {
      Object.defineProperty(globalThis, 'navigator', realNavigator);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  });

  it.each([
    ['es-MX', 'es'],
    ['it-IT', 'it'],
    ['sq-AL', 'sq'],
    ['sq', 'sq'],
    ['EN-gb', 'en'],
  ])('a device in %s starts in %s', (locale, expected) => {
    onDevice(locale);
    expect(deviceLanguage(SHIPPED, 'en')).toBe(expected);
  });

  it('a language the app does not ship falls back', () => {
    onDevice('de-DE');
    expect(deviceLanguage(SHIPPED, 'en')).toBe('en');
  });

  it('reads Intl when the host has no navigator language', () => {
    onDevice(null, 'it-CH');
    expect(deviceLanguage(SHIPPED, 'en')).toBe('it');
  });

  it('falls back when neither source can say', () => {
    onDevice(null, 'throws');
    expect(deviceLanguage(SHIPPED, 'en')).toBe('en');
  });
});
