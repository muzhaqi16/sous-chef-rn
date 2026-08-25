type InteropGlobal = {
  RN$LegacyInterop_UIManager_getConstantsForViewManager?: (
    name: string,
  ) => unknown;
};

/**
 * The probe's report is the only artifact a reader ever sees. An empty report
 * from a probe that never attached and an empty report from a run that queried
 * no view managers are the same bytes — and both read as "this costs nothing".
 */
describe('viewManagerProbe', () => {
  const g = globalThis as InteropGlobal;

  afterEach(() => {
    delete g.RN$LegacyInterop_UIManager_getConstantsForViewManager;
    jest.resetModules();
  });

  it('records per-view-manager timings once attached', () => {
    g.RN$LegacyInterop_UIManager_getConstantsForViewManager = (name: string) =>
      `constants:${name}`;
    jest.resetModules();
    const probe = require('../viewManagerProbe');

    probe.instrumentViewManagerConstants();
    const result =
      g.RN$LegacyInterop_UIManager_getConstantsForViewManager?.('RCTView');

    // The wrap must be transparent — it returns the original's value.
    expect(result).toBe('constants:RCTView');

    const report = JSON.parse(probe.summarizeViewManagerConstants());
    expect(report.attached).toBe(true);
    expect(report.count).toBe(1);
    expect(report.rows[0].name).toBe('RCTView');
  });

  it('says it did not observe when the interop global is absent', () => {
    jest.resetModules();
    const probe = require('../viewManagerProbe');

    probe.instrumentViewManagerConstants();

    const report = JSON.parse(probe.summarizeViewManagerConstants());
    // Not `count: 0` alone — that is indistinguishable from a real zero.
    expect(report.attached).toBe(false);
    expect(report.count).toBe(0);
  });
});
