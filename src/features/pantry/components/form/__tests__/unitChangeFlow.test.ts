import type { AlertButton } from 'react-native';
import { alertService } from '#/services/alertService';
import {
  ErrorCode,
  PantryUnitChangeMethod,
  PantryUnitChangeResolution,
} from '#/graphql/generated/schemaTypes';
import type {
  ChangeOutcome,
  PreviewOutcome,
  UnitChangePreview,
} from '#features/pantry/hooks/usePantryUnitChange';
import {
  runUnitChange,
  unitChangeMode,
  type UnitChangeDeps,
  type UnitChangeTarget,
} from '../unitChangeFlow';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));
const mockAlert = jest.mocked(alertService.alert);

const unit = (id: string, symbol: string): UnitChangePreview['toUnit'] => ({
  __typename: 'Unit',
  id,
  symbol,
  displayAsFraction: true,
});

const preview = (over: Partial<UnitChangePreview> = {}): UnitChangePreview => ({
  __typename: 'PantryUnitChangePreview',
  version: 3,
  method: PantryUnitChangeMethod.Conversion,
  exact: true,
  quantityIgnored: false,
  fromUnit: unit('u-ct', 'ct'),
  toUnit: unit('u-lb', 'lb'),
  quantityBefore: 2,
  heldQuantityBefore: 2,
  quantityAfter: 1.5,
  heldQuantityAfter: 1.5,
  batches: [],
  minQuantityAfter: null,
  restockQuantityAfter: null,
  dropsNetWeight: false,
  dropsPortions: false,
  dropsThresholds: false,
  conflictingPantryItemId: null,
  refusal: null,
  ...over,
});

const refusal = (
  code: ErrorCode,
  field: string,
): NonNullable<UnitChangePreview['refusal']> => ({
  __typename: 'PantryUnitChangeRefusal',
  code,
  field,
});

const ready = (p: UnitChangePreview): PreviewOutcome => ({
  status: 'ready',
  preview: p,
});

function deps(...previews: PreviewOutcome[]) {
  const previewFn = jest.fn<Promise<PreviewOutcome>, unknown[]>();
  for (const outcome of previews) previewFn.mockResolvedValueOnce(outcome);
  return {
    preview: previewFn,
    change: jest
      .fn<Promise<ChangeOutcome>, unknown[]>()
      .mockResolvedValue({ status: 'changed' }),
    reportFieldError: jest.fn(),
  } satisfies UnitChangeDeps;
}

const TARGET: UnitChangeTarget = { unitId: 'u-lb', quantity: null };

/** Answers the next alert by pressing the button whose label starts with `label`. */
function pressNext(label: string) {
  mockAlert.mockImplementationOnce((_title, _message, buttons) => {
    const button = (buttons ?? []).find((b: AlertButton) =>
      b.text?.startsWith(label),
    );
    if (!button) throw new Error(`No "${label}" button`);
    button.onPress?.();
  });
}

const alertMessage = (call = 0) => mockAlert.mock.calls[call]?.[1];
const alertLabels = (call = 0) =>
  (mockAlert.mock.calls[call]?.[2] ?? []).map((b: AlertButton) => b.text);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('unitChangeMode', () => {
  it('summarises an exact route and a recount previewed with an amount', () => {
    expect(unitChangeMode(preview())).toBe('summary');
    expect(
      unitChangeMode(preview({ method: PantryUnitChangeMethod.Recount })),
    ).toBe('summary');
  });

  it('offers the estimate where the route is approximate', () => {
    expect(
      unitChangeMode(
        preview({
          exact: false,
          refusal: refusal(ErrorCode.UnitChangeNeedsResolution, 'resolution'),
        }),
      ),
    ).toBe('estimate');
  });

  it('needs an amount where no route exists: 2 ct of chicken into lb', () => {
    expect(
      unitChangeMode(
        preview({
          method: null,
          refusal: refusal(ErrorCode.ValidationFailed, 'quantity'),
        }),
      ),
    ).toBe('recount');
  });

  it('needs one package size when a measure becomes a count', () => {
    expect(
      unitChangeMode(
        preview({
          method: null,
          refusal: refusal(ErrorCode.ValidationFailed, 'packageSize'),
        }),
      ),
    ).toBe('packageSize');
  });

  it('refuses when the item is already held in the new unit', () => {
    expect(unitChangeMode(preview({ conflictingPantryItemId: 'pi-2' }))).toBe(
      'refused',
    );
  });
});

describe('runUnitChange', () => {
  it('confirms the before and after in the app alert, then changes', async () => {
    const d = deps(ready(preview()));
    pressNext('Change unit');

    await expect(runUnitChange(d, TARGET)).resolves.toBe(true);

    expect(mockAlert).toHaveBeenCalledWith(
      'Change unit',
      expect.stringContaining('Exact conversion.'),
      expect.any(Array),
    );
    expect(alertLabels()).toEqual(['Cancel', 'Change unit']);
    expect(d.change).toHaveBeenCalledWith({ unitId: 'u-lb', version: 3 });
  });

  it('lists what the change drops before it is confirmed', async () => {
    const d = deps(
      ready(preview({ dropsNetWeight: true, dropsThresholds: true })),
    );
    pressNext('Change unit');

    await runUnitChange(d, TARGET);

    expect(alertMessage()).toContain('The package size will be removed.');
    expect(alertMessage()).toContain(
      'The low-stock alert levels will be cleared.',
    );
  });

  it('sends nothing when the user cancels', async () => {
    const d = deps(ready(preview()));
    pressNext('Cancel');

    await expect(runUnitChange(d, TARGET)).resolves.toBe(false);

    expect(d.change).not.toHaveBeenCalled();
    expect(d.reportFieldError).not.toHaveBeenCalled();
  });

  it('restates the typed amount as a recount: 2 ct of chicken as 1/2 lb', async () => {
    const d = deps(
      ready(
        preview({
          method: PantryUnitChangeMethod.Recount,
          exact: null,
          quantityAfter: 0.5,
        }),
      ),
    );
    pressNext('Change unit');

    await runUnitChange(d, { unitId: 'u-lb', quantity: 0.5 });

    expect(d.preview).toHaveBeenCalledWith({ unitId: 'u-lb', quantity: 0.5 });
    expect(alertMessage()).toContain('replaces the old one');
    expect(d.change).toHaveBeenCalledWith({
      unitId: 'u-lb',
      quantity: 0.5,
      resolution: PantryUnitChangeResolution.Recount,
      version: 3,
    });
  });

  describe('an approximate route', () => {
    const estimate = preview({
      exact: false,
      quantityAfter: 1.5,
      refusal: refusal(ErrorCode.UnitChangeNeedsResolution, 'resolution'),
    });

    it('converts by the estimate', async () => {
      const d = deps(ready(estimate));
      pressNext('Use the estimate');

      await runUnitChange(d, TARGET);

      expect(alertLabels()).toEqual([
        'Cancel',
        'Use the estimate: about 1 1/2 lb',
      ]);
      expect(alertMessage()).toContain('Or enter the amount yourself');
      expect(d.change).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: PantryUnitChangeResolution.Convert,
        }),
      );
    });

    it('offers the typed amount beside the estimate', async () => {
      const d = deps(ready(estimate));
      pressNext('Use my amount');

      await runUnitChange(d, { unitId: 'u-lb', quantity: 2 });

      expect(alertLabels()).toContain('Use my amount: 2 lb');
      expect(d.change).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: PantryUnitChangeResolution.Recount,
          quantity: 2,
        }),
      );
    });
  });

  describe('reports what the user must supply on its field', () => {
    it('an amount, where no route exists', async () => {
      const d = deps(
        ready(
          preview({
            method: null,
            refusal: refusal(ErrorCode.ValidationFailed, 'quantity'),
          }),
        ),
      );

      await expect(runUnitChange(d, TARGET)).resolves.toBe(false);

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'quantityInput',
        "ct can't be converted to lb for this item, so enter how much you have in lb.",
      );
      expect(mockAlert).not.toHaveBeenCalled();
    });

    it('one package size, when the form has none', async () => {
      const d = deps(
        ready(
          preview({
            method: null,
            toUnit: unit('u-stick', 'stick'),
            refusal: refusal(ErrorCode.ValidationFailed, 'packageSize'),
          }),
        ),
      );

      await runUnitChange(d, { unitId: 'u-stick', quantity: null });

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'netWeight',
        'To count this in stick, enter how much one stick holds, then save again.',
      );
    });

    it('the reason the change is refused', async () => {
      const d = deps(ready(preview({ conflictingPantryItemId: 'pi-2' })));

      await runUnitChange(d, TARGET);

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'unit',
        'You already have this item tracked in lb. Change that one instead, or pick a different unit.',
      );
      expect(d.change).not.toHaveBeenCalled();
    });

    it('a connection, offline', async () => {
      const d = deps({ status: 'offline' });

      await runUnitChange(d, TARGET);

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'unit',
        expect.stringContaining('needs a connection'),
      );
    });

    it('the server refusal, on the field it names', async () => {
      const d = deps(ready(preview()));
      d.change.mockResolvedValue({
        status: 'failed',
        field: 'quantity',
        message: 'Enter an amount above 0.',
      });
      pressNext('Change unit');

      await expect(runUnitChange(d, TARGET)).resolves.toBe(false);

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'quantityInput',
        'Enter an amount above 0.',
      );
    });
  });

  it("re-previews with the form's net weight as one package", async () => {
    const needsSize = preview({
      method: null,
      refusal: refusal(ErrorCode.ValidationFailed, 'packageSize'),
    });
    const d = deps(ready(needsSize), ready(preview()));
    pressNext('Change unit');
    const packageSize = { netWeight: 4, netWeightUnitId: 'u-oz' };

    await runUnitChange(d, { unitId: 'u-lb', quantity: null, packageSize });

    expect(d.preview).toHaveBeenLastCalledWith({
      unitId: 'u-lb',
      packageSize,
    });
    expect(d.change).toHaveBeenCalledWith(
      expect.objectContaining({ packageSize }),
    );
  });

  it('shows the new figures when the stack moved on, and confirms again', async () => {
    const d = deps(ready(preview()), ready(preview({ version: 4 })));
    d.change
      .mockResolvedValueOnce({ status: 'conflict' })
      .mockResolvedValueOnce({ status: 'changed' });
    pressNext('Change unit');
    pressNext('Change unit');

    await expect(runUnitChange(d, TARGET)).resolves.toBe(true);

    expect(alertMessage(1)).toMatch(
      /^This item changed while you were looking/,
    );
    expect(d.change).toHaveBeenLastCalledWith(
      expect.objectContaining({ version: 4 }),
    );
  });

  it('gives up after repeated conflicts', async () => {
    const d = deps(
      ready(preview()),
      ready(preview({ version: 4 })),
      ready(preview({ version: 5 })),
    );
    d.change.mockResolvedValue({ status: 'conflict' });
    for (let i = 0; i < 3; i += 1) pressNext('Change unit');

    await expect(runUnitChange(d, TARGET)).resolves.toBe(false);

    expect(d.change).toHaveBeenCalledTimes(3);
    expect(d.reportFieldError).toHaveBeenCalledWith(
      'unit',
      "Couldn't change the unit. Try again.",
    );
  });
});
