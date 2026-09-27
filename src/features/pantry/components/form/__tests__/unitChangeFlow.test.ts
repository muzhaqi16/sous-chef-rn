import { alertService, type AlertButton } from '#/services/alertService';
import {
  ErrorCode,
  PantryUnitChangeMethod,
  PantryUnitChangeResolution,
} from '#/graphql/generated/schemaTypes';
import type {
  ChangeOutcome,
  PreviewOutcome,
  UnitChangePreview,
  UnitChangeRequest,
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

const unit = (
  id: string,
  symbol: string,
  displayAsFraction = true,
): UnitChangePreview['toUnit'] => ({
  __typename: 'Unit',
  id,
  symbol,
  displayAsFraction,
});

const PC = unit('u-pc', 'pc');
const DOZ = unit('u-doz', 'doz', false);
const LB = unit('u-lb', 'lb');

/** 1 egg converted into dozens: the route the server takes with no resolution. */
const converted = (
  over: Partial<UnitChangePreview> = {},
): UnitChangePreview => ({
  __typename: 'PantryUnitChangePreview',
  version: 3,
  method: PantryUnitChangeMethod.Conversion,
  exact: true,
  quantityIgnored: false,
  fromUnit: PC,
  toUnit: DOZ,
  quantityBefore: 1,
  heldQuantityBefore: 1,
  quantityAfter: 1 / 12,
  heldQuantityAfter: 1 / 12,
  batches: [],
  minQuantityAfter: null,
  restockQuantityAfter: null,
  dropsNetWeight: false,
  dropsPortions: false,
  dropsThresholds: false,
  conflictingPantryItemId: null,
  displayAmountAfter: null,
  refusal: null,
  ...over,
});

/** The same stack set to the form's amount in the new unit. */
const setTo = (
  quantity: number,
  over: Partial<UnitChangePreview> = {},
): UnitChangePreview =>
  converted({
    method: PantryUnitChangeMethod.Recount,
    exact: null,
    quantityAfter: quantity,
    heldQuantityAfter: quantity,
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

type Request = Omit<UnitChangeRequest, 'pantryItemId'>;

/**
 * Answers a recount preview with `set`, and each other preview with the next
 * of `convert` (the last one repeating).
 */
function deps(
  convert: PreviewOutcome | PreviewOutcome[],
  set: PreviewOutcome = ready(setTo(1)),
) {
  const queue = Array.isArray(convert) ? [...convert] : [convert];
  const preview = jest.fn((request: Request) => {
    if (request.resolution === PantryUnitChangeResolution.Recount) {
      return Promise.resolve(set);
    }
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (!next) throw new Error('No preview queued');
    return Promise.resolve(next);
  });
  return {
    preview,
    change: jest
      .fn<Promise<ChangeOutcome>, [Request & { version: number }]>()
      .mockResolvedValue({ status: 'changed' }),
    reportFieldError: jest.fn(),
  } satisfies UnitChangeDeps;
}

const EGGS: UnitChangeTarget = { unitId: 'u-doz', amount: 1 };

/** Answers the next alert by pressing the button whose label starts with `label`. */
function pressNext(label: string) {
  mockAlert.mockImplementationOnce((_title, _message, buttons) => {
    const button = (buttons ?? []).find((b: AlertButton) =>
      b.text.startsWith(label),
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
  it('summarises an exact route and a recount', () => {
    expect(unitChangeMode(converted())).toBe('summary');
    expect(unitChangeMode(setTo(1))).toBe('summary');
  });

  it('offers the estimate where the route is approximate', () => {
    expect(
      unitChangeMode(
        converted({
          exact: false,
          refusal: refusal(ErrorCode.UnitChangeNeedsResolution, 'resolution'),
        }),
      ),
    ).toBe('estimate');
  });

  it('needs an amount where no route exists', () => {
    expect(
      unitChangeMode(
        converted({
          method: null,
          refusal: refusal(ErrorCode.ValidationFailed, 'quantity'),
        }),
      ),
    ).toBe('recount');
  });

  it('needs one package size when a measure becomes a count', () => {
    expect(
      unitChangeMode(
        converted({
          method: null,
          refusal: refusal(ErrorCode.ValidationFailed, 'packageSize'),
        }),
      ),
    ).toBe('packageSize');
  });

  it('refuses when the item is already held in the new unit', () => {
    expect(unitChangeMode(converted({ conflictingPantryItemId: 'pi-2' }))).toBe(
      'refused',
    );
  });
});

describe('runUnitChange', () => {
  describe('where the conversion changes the amount: 1 pc into dozens', () => {
    it('asks whether it is 1 doz or 1 pc converted', async () => {
      const d = deps(ready(converted()));
      pressNext('Cancel');

      await runUnitChange(d, EGGS);

      expect(alertMessage()).toBe('Is it 1 doz, or should 1 pc be converted?');
      expect(alertLabels()).toEqual([
        'Set to 1 doz',
        'Convert to 0.083 doz',
        'Cancel',
      ]);
    });

    it('sets the stock to the amount in the form', async () => {
      const d = deps(ready(converted()));
      pressNext('Set to');

      await expect(runUnitChange(d, EGGS)).resolves.toBe(true);

      expect(d.change).toHaveBeenCalledWith({
        unitId: 'u-doz',
        resolution: PantryUnitChangeResolution.Recount,
        quantity: 1,
        version: 3,
      });
    });

    it('converts the stock', async () => {
      const d = deps(ready(converted()));
      pressNext('Convert to');

      await runUnitChange(d, EGGS);

      expect(d.change).toHaveBeenCalledWith({ unitId: 'u-doz', version: 3 });
    });

    it('sends nothing on Cancel', async () => {
      const d = deps(ready(converted()));
      pressNext('Cancel');

      await expect(runUnitChange(d, EGGS)).resolves.toBe(false);

      expect(d.change).not.toHaveBeenCalled();
      expect(d.reportFieldError).not.toHaveBeenCalled();
    });

    it('lists what each choice leaves behind where they differ', async () => {
      const d = deps(
        ready(converted({ dropsThresholds: true })),
        ready(setTo(1, { minQuantityAfter: 6 })),
      );
      pressNext('Cancel');

      await runUnitChange(d, EGGS);

      expect(alertMessage()).toBe(
        [
          'Is it 1 doz, or should 1 pc be converted?',
          'If set to 1 doz:',
          'Alert when below: 6 doz',
          'If converted:',
          'The low-stock alert levels will be cleared.',
        ].join('\n'),
      );
    });

    it('lists it once where they agree', async () => {
      const d = deps(
        ready(converted({ dropsNetWeight: true })),
        ready(setTo(1, { dropsNetWeight: true })),
      );
      pressNext('Cancel');

      await runUnitChange(d, EGGS);

      expect(alertMessage()).toBe(
        [
          'Is it 1 doz, or should 1 pc be converted?',
          'The package size will be removed.',
        ].join('\n'),
      );
    });
  });

  describe('where the conversion lands on the amount in the form', () => {
    // 0.999996 doz converts to 11.99995 pc: shown as the 12 typed, but not it.
    const noisy = converted({
      fromUnit: DOZ,
      toUnit: PC,
      quantityBefore: 0.999996,
      quantityAfter: 11.999952,
    });
    const TWELVE: UnitChangeTarget = { unitId: 'u-pc', amount: 12 };

    it('confirms once, and sets exactly the amount shown', async () => {
      const d = deps(
        ready(noisy),
        ready(setTo(12, { fromUnit: DOZ, toUnit: PC })),
      );
      pressNext('Change unit');

      await runUnitChange(d, TWELVE);

      expect(alertLabels()).toEqual(['Cancel', 'Change unit']);
      expect(alertMessage()).toBe('1 doz → 12 pc\nExact conversion.');
      expect(d.change).toHaveBeenCalledWith({
        unitId: 'u-pc',
        resolution: PantryUnitChangeResolution.Recount,
        quantity: 12,
        version: 3,
      });
    });

    it('converts where setting would leave something else behind', async () => {
      const d = deps(
        ready(noisy),
        ready(setTo(12, { fromUnit: DOZ, toUnit: PC, dropsNetWeight: true })),
      );
      pressNext('Change unit');

      await runUnitChange(d, TWELVE);

      expect(d.change).toHaveBeenCalledWith({ unitId: 'u-pc', version: 3 });
    });
  });

  describe('a dozen on a stack of pieces, which only changes how it reads', () => {
    const reads = (
      quantity: number,
      text: string,
    ): UnitChangePreview['displayAmountAfter'] => ({
      __typename: 'DisplayAmount',
      quantity,
      text,
    });
    const shownIn = (held: number, text: string) =>
      converted({
        toUnit: PC,
        quantityBefore: held,
        quantityAfter: held,
        displayAmountAfter: reads(held, text),
      });
    const setToDozen = (text: string) =>
      ready(
        setTo(12, {
          toUnit: PC,
          quantityBefore: 11,
          displayAmountAfter: reads(1, text),
        }),
      );
    const ONE_DOZEN: UnitChangeTarget = {
      unitId: 'u-doz',
      amount: 1,
      shownBefore: '11 pc',
    };

    it('asks whether it is a dozen now, or keeps the count', async () => {
      const d = deps(ready(shownIn(11, '11 pc')), setToDozen('1 doz'));
      pressNext('Set to');

      await runUnitChange(d, ONE_DOZEN);

      expect(alertMessage()).toBe('Is it 1 doz, or keep 11 pc?');
      expect(alertLabels()).toEqual(['Set to 1 doz', 'Keep 11 pc', 'Cancel']);
      // The server restates the dozen in pieces.
      expect(d.change).toHaveBeenCalledWith({
        unitId: 'u-doz',
        resolution: PantryUnitChangeResolution.Recount,
        quantity: 1,
        version: 3,
      });
    });

    it('keeps the count and only changes how it reads', async () => {
      const d = deps(ready(shownIn(11, '11 pc')), setToDozen('1 doz'));
      pressNext('Keep');

      await runUnitChange(d, ONE_DOZEN);

      expect(d.change).toHaveBeenCalledWith({ unitId: 'u-doz', version: 3 });
    });

    it('confirms once where both read the same', async () => {
      const d = deps(ready(shownIn(12, '1 doz')), setToDozen('1 doz'));
      pressNext('Change unit');

      await runUnitChange(d, { ...ONE_DOZEN, shownBefore: '12 pc' });

      expect(alertMessage()).toBe('12 pc → 1 doz\nExact conversion.');
      expect(d.change).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 1 }),
      );
    });
  });

  it('only converts an empty stack, which takes no amount', async () => {
    const d = deps(
      ready(converted({ quantityBefore: 0, quantityAfter: 0 })),
      ready(setTo(0, { quantityIgnored: true })),
    );
    pressNext('Change unit');

    await runUnitChange(d, { unitId: 'u-doz', amount: 3 });

    expect(alertLabels()).toEqual(['Cancel', 'Change unit']);
    expect(d.change).toHaveBeenCalledWith({ unitId: 'u-doz', version: 3 });
  });

  describe('where no route exists: 2 ct of chicken as 1/2 lb', () => {
    const noRoute = converted({
      toUnit: LB,
      quantityBefore: 2,
      method: null,
      exact: null,
      quantityAfter: null,
      refusal: refusal(ErrorCode.ValidationFailed, 'quantity'),
    });
    const CHICKEN: UnitChangeTarget = { unitId: 'u-lb', amount: 0.5 };

    it('confirms the amount in the form as the stock', async () => {
      const d = deps(
        ready(noRoute),
        ready(setTo(0.5, { toUnit: LB, quantityBefore: 2 })),
      );
      pressNext('Change unit');

      await runUnitChange(d, CHICKEN);

      expect(alertMessage()).toBe(
        "2 pc → 1/2 lb\nThese units don't convert for this item, so the stock is set to this amount.",
      );
      expect(d.change).toHaveBeenCalledWith({
        unitId: 'u-lb',
        resolution: PantryUnitChangeResolution.Recount,
        quantity: 0.5,
        version: 3,
      });
    });

    it('asks for an amount on its field where the server takes none', async () => {
      const d = deps(
        ready(noRoute),
        ready(
          setTo(0.5, {
            method: null,
            refusal: refusal(ErrorCode.ValidationFailed, 'quantity'),
          }),
        ),
      );

      await expect(runUnitChange(d, CHICKEN)).resolves.toBe(false);

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'quantityInput',
        "pc can't be converted to lb for this item, so enter how much you have in lb.",
      );
      expect(mockAlert).not.toHaveBeenCalled();
    });
  });

  describe('an approximate route', () => {
    const estimate = converted({
      toUnit: LB,
      quantityBefore: 2,
      exact: false,
      quantityAfter: 1.5,
      refusal: refusal(ErrorCode.UnitChangeNeedsResolution, 'resolution'),
    });
    const TARGET: UnitChangeTarget = { unitId: 'u-lb', amount: 2 };

    it('offers the amount in the form beside the estimate', async () => {
      const d = deps(ready(estimate), ready(setTo(2, { toUnit: LB })));
      pressNext('Convert to about');

      await runUnitChange(d, TARGET);

      expect(alertLabels()).toEqual([
        'Set to 2 lb',
        'Convert to about 1 1/2 lb',
        'Cancel',
      ]);
      expect(d.change).toHaveBeenCalledWith({
        unitId: 'u-lb',
        resolution: PantryUnitChangeResolution.Convert,
        version: 3,
      });
    });

    it('sets the amount in the form', async () => {
      const d = deps(ready(estimate), ready(setTo(2, { toUnit: LB })));
      pressNext('Set to');

      await runUnitChange(d, TARGET);

      expect(d.change).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: PantryUnitChangeResolution.Recount,
          quantity: 2,
        }),
      );
    });
  });

  describe('a measure becoming a count: 1 lb of butter into sticks', () => {
    const STICK = unit('u-stick', 'stick');
    const needsSize = converted({
      fromUnit: LB,
      toUnit: STICK,
      method: null,
      exact: null,
      quantityAfter: null,
      refusal: refusal(ErrorCode.ValidationFailed, 'packageSize'),
    });
    const set = ready(setTo(1, { fromUnit: LB, toUnit: STICK }));
    const BUTTER: UnitChangeTarget = { unitId: 'u-stick', amount: 1 };

    it('offers the amount in the form, or a package size to convert', async () => {
      const d = deps(ready(needsSize), set);
      pressNext('Set to');

      await runUnitChange(d, BUTTER);

      expect(alertMessage()).toBe(
        'To convert, enter how much one stick holds. Or set the stock to 1 stick.',
      );
      expect(alertLabels()).toEqual([
        'Set to 1 stick',
        'Enter package size',
        'Cancel',
      ]);
      expect(d.change).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 1 }),
      );
    });

    it('takes the user to the net weight to enter one', async () => {
      const d = deps(ready(needsSize), set);
      pressNext('Enter package size');

      await expect(runUnitChange(d, BUTTER)).resolves.toBe(false);

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'netWeight',
        'To count this in stick, enter how much one stick holds, then save again.',
      );
      expect(d.change).not.toHaveBeenCalled();
    });

    it("converts by the form's net weight as one package", async () => {
      const packageSize = { netWeight: 4, netWeightUnitId: 'u-oz' };
      const sized = converted({
        fromUnit: LB,
        toUnit: STICK,
        method: PantryUnitChangeMethod.Weight,
        quantityAfter: 4,
      });
      const d = deps([ready(needsSize), ready(sized)], set);
      pressNext('Convert to');

      await runUnitChange(d, { ...BUTTER, packageSize });

      expect(d.preview).toHaveBeenCalledWith({
        unitId: 'u-stick',
        packageSize,
      });
      expect(alertLabels()).toContain('Convert to 4 stick');
      expect(d.change).toHaveBeenCalledWith({
        unitId: 'u-stick',
        packageSize,
        version: 3,
      });
    });
  });

  describe('reports on its field', () => {
    it('the reason the change is refused', async () => {
      const d = deps(ready(converted({ conflictingPantryItemId: 'pi-2' })));

      await runUnitChange(d, EGGS);

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'unit',
        'You already have this item tracked in doz. Change that one instead, or pick a different unit.',
      );
      expect(d.change).not.toHaveBeenCalled();
    });

    it('that a connection is needed, offline', async () => {
      const d = deps({ status: 'offline' }, { status: 'offline' });

      await runUnitChange(d, EGGS);

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'unit',
        expect.stringContaining('needs a connection'),
      );
    });

    it('a server refusal, on the field it names', async () => {
      const d = deps(ready(converted()));
      d.change.mockResolvedValue({
        status: 'failed',
        field: 'quantity',
        message: 'Enter an amount above 0.',
      });
      pressNext('Set to');

      await expect(runUnitChange(d, EGGS)).resolves.toBe(false);

      expect(d.reportFieldError).toHaveBeenCalledWith(
        'quantityInput',
        'Enter an amount above 0.',
      );
    });
  });

  it('shows the new figures when the stack moved on, and asks again', async () => {
    const d = deps([ready(converted()), ready(converted({ version: 4 }))]);
    d.change
      .mockResolvedValueOnce({ status: 'conflict' })
      .mockResolvedValueOnce({ status: 'changed' });
    pressNext('Convert to');
    pressNext('Convert to');

    await expect(runUnitChange(d, EGGS)).resolves.toBe(true);

    expect(alertMessage(1)).toMatch(
      /^This item changed while you were looking/,
    );
    expect(d.change).toHaveBeenLastCalledWith(
      expect.objectContaining({ version: 4 }),
    );
  });

  it('gives up after repeated conflicts', async () => {
    const d = deps(ready(converted()));
    d.change.mockResolvedValue({ status: 'conflict' });
    for (let i = 0; i < 3; i += 1) pressNext('Convert to');

    await expect(runUnitChange(d, EGGS)).resolves.toBe(false);

    expect(d.change).toHaveBeenCalledTimes(3);
    expect(d.reportFieldError).toHaveBeenCalledWith(
      'unit',
      "Couldn't change the unit. Try again.",
    );
  });
});
