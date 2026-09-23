import {
  ErrorCode,
  PantryUnitChangeMethod,
  PantryUnitChangeResolution,
} from '#/graphql/generated/schemaTypes';
import type { UnitChangePreview } from '#features/pantry/hooks/usePantryUnitChange';
import {
  changeChoice,
  unitChangeDefaults,
  unitChangeMode,
  unitChangeSchema,
  type UnitChangeFormValues,
} from '../unitChangeFormConfig';

const preview = (over: Partial<UnitChangePreview>): UnitChangePreview =>
  ({
    version: 1,
    method: PantryUnitChangeMethod.Conversion,
    exact: true,
    refusal: null,
    conflictingPantryItemId: null,
    ...over,
  } as UnitChangePreview);

const refusal = (
  code: ErrorCode,
  field: string,
): NonNullable<UnitChangePreview['refusal']> => ({
  __typename: 'PantryUnitChangeRefusal',
  code,
  field,
});

describe('unitChangeMode', () => {
  it('summarises an exact route', () => {
    expect(unitChangeMode(preview({}))).toBe('summary');
  });

  it('asks for the estimate or an amount where the route is approximate', () => {
    expect(
      unitChangeMode(
        preview({
          exact: false,
          refusal: refusal(ErrorCode.UnitChangeNeedsResolution, 'resolution'),
        }),
      ),
    ).toBe('estimate');
  });

  it('asks for an amount where no route exists: 2 ct of chicken into lb', () => {
    expect(
      unitChangeMode(
        preview({
          method: null,
          refusal: refusal(ErrorCode.ValidationFailed, 'quantity'),
        }),
      ),
    ).toBe('recount');
  });

  it('summarises a recount previewed with an amount', () => {
    expect(
      unitChangeMode(preview({ method: PantryUnitChangeMethod.Recount })),
    ).toBe('summary');
  });

  it('asks for one package size when a measure becomes a count', () => {
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

describe('changeChoice', () => {
  const values = (over: Partial<UnitChangeFormValues>) => ({
    ...unitChangeDefaults('1/2'),
    ...over,
  });

  it('sends nothing extra for an exact route', () => {
    expect(changeChoice('summary', preview({}), values({}), 0.5)).toEqual({});
  });

  it('recounts with the amount entered', () => {
    expect(changeChoice('recount', preview({}), values({}), null)).toEqual({
      resolution: PantryUnitChangeResolution.Recount,
      quantity: 0.5,
    });
  });

  it('converts, or recounts, as chosen on an estimate', () => {
    expect(
      changeChoice('estimate', preview({}), values({ choice: 'estimate' }), 1),
    ).toEqual({ resolution: PantryUnitChangeResolution.Convert });
    expect(
      changeChoice('estimate', preview({}), values({ choice: 'mine' }), 1),
    ).toEqual({
      resolution: PantryUnitChangeResolution.Recount,
      quantity: 0.5,
    });
  });

  it('carries the previewed amount into a summarised recount', () => {
    expect(
      changeChoice(
        'summary',
        preview({ method: PantryUnitChangeMethod.Recount }),
        values({}),
        0.5,
      ),
    ).toEqual({
      resolution: PantryUnitChangeResolution.Recount,
      quantity: 0.5,
    });
  });
});

describe('unitChangeSchema', () => {
  const validate = (mode: string, over: Partial<UnitChangeFormValues>) =>
    unitChangeSchema.isValid(
      { ...unitChangeDefaults(''), ...over },
      { context: { mode } },
    );

  it('needs an amount only where it is asked for', async () => {
    await expect(validate('recount', { amount: '' })).resolves.toBe(false);
    await expect(validate('recount', { amount: '1/2' })).resolves.toBe(true);
    await expect(validate('summary', { amount: '' })).resolves.toBe(true);
    await expect(
      validate('estimate', { choice: 'estimate', amount: '' }),
    ).resolves.toBe(true);
    await expect(
      validate('estimate', { choice: 'mine', amount: '' }),
    ).resolves.toBe(false);
  });

  it('needs a size and its unit for a package size', async () => {
    await expect(
      validate('packageSize', { packageAmount: '32', packageUnitId: null }),
    ).resolves.toBe(false);
    await expect(
      validate('packageSize', { packageAmount: '32', packageUnitId: 'u-oz' }),
    ).resolves.toBe(true);
  });
});
