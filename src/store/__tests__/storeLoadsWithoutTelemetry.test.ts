/**
 * The store tells telemetry the person's consent through a module with no
 * imports, so creating the store never loads the telemetry service: a cold start
 * does not pay for it, and the two cannot close an import cycle.
 */
it('loads without loading the telemetry service', () => {
  jest.isolateModules(() => {
    jest.doMock('#services/telemetry/TelemetryService', () => {
      throw new Error('the store loaded the telemetry service');
    });

    expect(() => require('#store')).not.toThrow();
  });
});
