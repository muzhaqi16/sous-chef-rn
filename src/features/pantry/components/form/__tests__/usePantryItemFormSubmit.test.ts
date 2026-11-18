import { act, renderHook } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  type MockDataFor,
  recordMock,
  renderHookWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { alertService } from '#/services/alertService';
import type { AlertButton } from '#platform/presenters';
import { t } from '#/i18n';
import {
  ErrorCode,
  ItemCondition,
  PantryUnitChangeMethod,
  PantryUnitChangeResolution,
  StorageState,
  StorageType,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import {
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import { useUpdatePantryItem } from '#features/pantry/hooks/mutations/useUpdatePantryItem';
import { useUpdatePantryItemQuantity } from '#features/pantry/hooks/mutations/useUpdatePantryItemQuantity';
import type {
  ChangeOutcome,
  PreviewOutcome,
  UnitChangePreview,
} from '#features/pantry/hooks/usePantryUnitChange';
import { UseUpdatePantryItem_PantryItemFragmentDoc } from '#features/pantry/hooks/mutations/useUpdatePantryItem.generated';
import { PantryItemForm_PantryItemFragmentDoc } from '../PantryItemForm.generated';
import type { PantryItemFormData } from '../PantryItemForm';
import {
  usePantryItemFormSubmit,
  type UsePantryItemFormSubmitParams,
} from '../usePantryItemFormSubmit';

type Params = UsePantryItemFormSubmitParams;
type PreviewRequest = Parameters<Params['unitChange']['preview']>[0];
type PreviewUnit = UnitChangePreview['toUnit'];

const STACK = 'item-1';

const unit = (
  id: string,
  symbol: string,
  type: UnitType,
  extra: { conversionFactor?: number } = {},
) =>
  asAbbreviation({
    __typename: 'Unit',
    id,
    name: symbol,
    symbol,
    type,
    displayAsFraction: false,
    conversionFactor: extra.conversionFactor ?? null,
  });
const LITRE = unit('unit-l', 'L', UnitType.Volume);
const KG = unit('unit-kg', 'kg', UnitType.Weight);
const PIECE = unit('unit-pc', 'pc', UnitType.Count);
const DOZEN = unit('unit-doz', 'doz', UnitType.Count, { conversionFactor: 12 });

const selection = (picked: typeof LITRE) => ({
  id: picked.id,
  name: picked.name,
  symbol: picked.symbol,
  type: picked.type,
});

/**
 * A stack as the form reads it; `shown` is how its amount reads, when not as
 * held, and `showsIn` the unit the server may show it in.
 */
function stackHolding({
  quantity,
  held = LITRE,
  shown,
  showsIn = shown?.unit ?? null,
}: {
  quantity: number;
  held?: typeof LITRE;
  shown?: { quantity: number; unit: typeof DOZEN };
  showsIn?: typeof DOZEN | null;
}) {
  const cache = makeCache();
  const amountUnit = shown?.unit ?? held;
  seedFragment(cache, {
    fragment: PantryItemForm_PantryItemFragmentDoc,
    id: `PantryItem:${STACK}`,
    data: {
      __typename: 'PantryItem',
      id: STACK,
      version: 1,
      quantity,
      unit: held,
      displayAmount: {
        __typename: 'DisplayAmount',
        quantity: shown?.quantity ?? quantity,
        localizedSymbol: amountUnit.symbol,
        fraction: null,
        unit: amountUnit,
      },
      displayUnit: showsIn,
    },
  });
  const stack = cache.readFragment({
    fragment: PantryItemForm_PantryItemFragmentDoc,
    id: `PantryItem:${STACK}`,
  });
  if (!stack) throw new Error('the stack was not seeded');
  return stack;
}

/** Two litres of milk, as the form opens on it. */
const FORM: PantryItemFormData = {
  itemName: 'Milk',
  quantityInput: '2',
  unit: 'L',
  storageState: StorageState.Ambient,
  condition: ItemCondition.Good,
  location: '',
  notes: '',
  brand: '',
  netWeight: '',
  netWeightUnit: '',
  netWeightUnitId: '',
};

/** What the server says a change would do: `from` as held, onto `to`. */
const previewing =
  (from: { quantity: number; unit: PreviewUnit }, to: PreviewUnit) =>
  async (request: PreviewRequest): Promise<PreviewOutcome> => ({
    status: 'ready',
    preview: {
      __typename: 'PantryUnitChangePreview',
      version: 3,
      method:
        request.resolution === PantryUnitChangeResolution.Recount
          ? PantryUnitChangeMethod.Recount
          : PantryUnitChangeMethod.Conversion,
      exact: true,
      quantityIgnored: false,
      fromUnit: from.unit,
      toUnit: to,
      quantityBefore: from.quantity,
      heldQuantityBefore: from.quantity,
      quantityAfter: request.quantity ?? from.quantity,
      heldQuantityAfter: request.quantity ?? from.quantity,
      batches: [],
      minQuantityAfter: null,
      restockQuantityAfter: null,
      dropsNetWeight: false,
      dropsPortions: false,
      dropsThresholds: false,
      conflictingPantryItemId: null,
      displayAmountAfter: null,
      refusal: null,
    },
  });

interface Setup extends Partial<Params> {
  quantityStands?: boolean;
  fieldsStand?: boolean;
  /** What a typed unit resolves to, by what was typed. */
  units?: Record<string, string>;
  preview?: Params['unitChange']['preview'];
}

function renderSave({
  quantityStands = true,
  fieldsStand = true,
  units = {},
  preview = previewing({ quantity: 2, unit: LITRE }, KG),
  ...over
}: Setup = {}) {
  const fakes = {
    updatePantryItemFields: jest.fn<
      Promise<boolean>,
      Parameters<Params['updatePantryItemFields']>
    >(async () => fieldsStand),
    updateQuantity: jest.fn<
      Promise<boolean>,
      Parameters<Params['updateQuantity']>
    >(async () => quantityStands),
    resolveUnitId: jest.fn(
      async (_id: string | null, typed: string) => units[typed] ?? null,
    ),
    preview: jest.fn(preview),
    change: jest.fn(
      async (): Promise<ChangeOutcome> => ({ status: 'changed' }),
    ),
    reportFieldError: jest.fn(),
    onSuccess: jest.fn(),
  };
  const params: Params = {
    itemId: STACK,
    currentPantryId: 'pantry-1',
    existingPantryItem: stackHolding({ quantity: 2 }),
    dirtyFields: {},
    trackingUnit: selection(LITRE),
    netWeightUnitId: null,
    selectedLocationId: null,
    selectedBrandId: null,
    selectedStorageLocation: null,
    updatePantryItemFields: fakes.updatePantryItemFields,
    updateQuantity: fakes.updateQuantity,
    resolveUnitId: fakes.resolveUnitId,
    unitChange: { preview: fakes.preview, change: fakes.change },
    reportFieldError: fakes.reportFieldError,
    onSuccess: fakes.onSuccess,
    ...over,
  };
  const { result } = renderHook(() => usePantryItemFormSubmit(params));
  return {
    ...fakes,
    save: (data: Partial<PantryItemFormData> = {}) =>
      result.current.handleSave({ ...FORM, ...data }),
  };
}

/** Resolves with the next alert, as the user sees it. */
const nextAlert = () =>
  new Promise<{ message?: string; buttons: AlertButton[] }>(resolve => {
    jest
      .spyOn(alertService, 'alert')
      .mockImplementationOnce((_title, message, buttons = []) =>
        resolve({ message, buttons }),
      );
  });
const pressed = (buttons: AlertButton[], style: 'cancel' | 'confirm') =>
  buttons
    .find(button => (style === 'cancel') === (button.style === 'cancel'))
    ?.onPress?.();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('refusing to save', () => {
  it('says so with no pantry, and sends nothing', async () => {
    const form = renderSave({
      currentPantryId: null,
      dirtyFields: { notes: true },
    });

    await form.save({ notes: 'Top shelf' });

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('itemForm.noPantrySelected'),
    );
    expect(form.updatePantryItemFields).not.toHaveBeenCalled();
  });

  it('says so with no stack, and sends nothing', async () => {
    const form = renderSave({
      existingPantryItem: null,
      dirtyFields: { notes: true },
    });

    await form.save({ notes: 'Top shelf' });

    expect(alertService.alert).toHaveBeenCalledWith(
      t('labels.error'),
      t('errors.itemNotFound'),
    );
    expect(form.updatePantryItemFields).not.toHaveBeenCalled();
  });

  it.each(['', '0'])(
    'refuses an amount changed to "%s", saving nothing',
    async quantityInput => {
      const form = renderSave({
        dirtyFields: { quantityInput: true, notes: true },
      });

      await form.save({ quantityInput, notes: 'Top shelf' });

      expect(alertService.alert).toHaveBeenCalledWith(
        t('labels.error'),
        t('errors.invalidQuantity'),
      );
      expect(form.updateQuantity).not.toHaveBeenCalled();
      expect(form.updatePantryItemFields).not.toHaveBeenCalled();
    },
  );

  it('judges only an amount that changed: an empty stack takes a notes edit', async () => {
    const form = renderSave({
      existingPantryItem: stackHolding({ quantity: 0 }),
      dirtyFields: { notes: true },
    });

    await form.save({ quantityInput: '0', notes: 'Top shelf' });

    expect(alertService.alert).not.toHaveBeenCalled();
    expect(form.updatePantryItemFields).toHaveBeenCalledTimes(1);
  });
});

describe('the amount', () => {
  it('is set in the unit the stack counts in, and the form closes', async () => {
    const form = renderSave({ dirtyFields: { quantityInput: true } });

    await form.save({ quantityInput: '3' });

    expect(form.updateQuantity).toHaveBeenCalledWith({
      itemId: STACK,
      quantityInput: '3',
      quantityValue: 3,
      statedIn: null,
    });
    expect(form.preview).not.toHaveBeenCalled();
    expect(form.onSuccess).toHaveBeenCalledTimes(1);
  });

  // Sent back unedited, the seed would rewrite the stock.
  it('goes as stored when the field holds the seed it rounded', async () => {
    const form = renderSave({
      existingPantryItem: stackHolding({ quantity: 1.23456 }),
      dirtyFields: { quantityInput: true },
    });

    await form.save({ quantityInput: '1.235' });

    expect(form.updateQuantity).toHaveBeenCalledWith(
      expect.objectContaining({
        quantityInput: '1.23456',
        quantityValue: 1.23456,
      }),
    );
  });

  it.each([
    // 12 pc reads "1 doz", so the form edits dozens.
    [
      'shown in dozens',
      { quantity: 12, shown: { quantity: 1, unit: DOZEN } },
      {},
    ],
    // 11 pc reads "11 pc"; picking the dozen it can be shown in states the
    // amount in it, and changes no unit.
    [
      'shown in pieces, set in the dozen',
      { quantity: 11, showsIn: DOZEN },
      { unit: true },
    ],
  ])('of pieces %s is stated in the dozen', async (_case, stack, dirty) => {
    const form = renderSave({
      existingPantryItem: stackHolding({ held: PIECE, ...stack }),
      trackingUnit: selection(DOZEN),
      dirtyFields: { quantityInput: true, ...dirty },
    });

    await form.save({ unit: 'doz', quantityInput: '1' });

    expect(form.preview).not.toHaveBeenCalled();
    expect(form.updateQuantity).toHaveBeenCalledWith(
      expect.objectContaining({
        quantityValue: 1,
        statedIn: expect.objectContaining({ id: 'unit-doz' }),
      }),
    );
  });

  it('keeps the form open, saving nothing else, when refused', async () => {
    const form = renderSave({
      quantityStands: false,
      dirtyFields: { quantityInput: true, notes: true },
    });

    await form.save({ quantityInput: '3', notes: 'Top shelf' });

    expect(form.updatePantryItemFields).not.toHaveBeenCalled();
    expect(form.onSuccess).not.toHaveBeenCalled();
  });
});

describe('the other fields', () => {
  const freezer = {
    id: 'loc-1',
    name: 'Chest freezer',
    type: StorageType.Freezer,
  };

  it('are saved after the amount, with what was picked, never the unit', async () => {
    const form = renderSave({
      dirtyFields: { quantityInput: true, notes: true, unit: true },
      selectedLocationId: 'loc-1',
      selectedBrandId: 'brand-1',
      selectedStorageLocation: freezer,
    });

    await form.save({ quantityInput: '3', notes: 'Top shelf' });

    expect(form.updatePantryItemFields).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: STACK,
        dirtyFields: { quantityInput: true, notes: true },
        selectedLocationId: 'loc-1',
        selectedBrandId: 'brand-1',
        selectedStorageLocation: freezer,
      }),
    );
    expect(form.updateQuantity.mock.invocationCallOrder[0]).toBeLessThan(
      form.updatePantryItemFields.mock.invocationCallOrder[0] ?? 0,
    );
    expect(form.onSuccess).toHaveBeenCalledTimes(1);
  });

  // react-hook-form marks an edited list with a flag per entry.
  it('count an edited list as a change', async () => {
    const form = renderSave({ dirtyFields: { tags: [true, false] } });

    await form.save({ tags: ['dairy'] });

    expect(form.updatePantryItemFields).toHaveBeenCalledWith(
      expect.objectContaining({ dirtyFields: { tags: true } }),
    );
  });

  it('keep the form open when refused', async () => {
    const form = renderSave({
      fieldsStand: false,
      dirtyFields: { notes: true },
    });

    await form.save({ notes: 'Top shelf' });

    expect(form.onSuccess).not.toHaveBeenCalled();
  });

  it('close the form when nothing changed, sending nothing', async () => {
    const form = renderSave();

    await form.save();

    expect(form.onSuccess).toHaveBeenCalledTimes(1);
    expect(form.updateQuantity).not.toHaveBeenCalled();
    expect(form.updatePantryItemFields).not.toHaveBeenCalled();
  });

  it('send a typed net-weight unit by the id it resolves to', async () => {
    const form = renderSave({
      dirtyFields: { netWeight: true },
      units: { oz: 'unit-oz' },
    });

    await form.save({ netWeight: '12', netWeightUnit: 'oz' });

    expect(form.updatePantryItemFields).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ netWeightUnitId: 'unit-oz' }),
      }),
    );
  });

  it('report a net-weight unit it cannot resolve on its field, saving nothing', async () => {
    const form = renderSave({ dirtyFields: { netWeight: true } });

    await form.save({ netWeight: '12', netWeightUnit: 'ozz' });

    expect(form.reportFieldError).toHaveBeenCalledWith(
      'netWeightUnit',
      t('itemForm.unknownUnit', { unit: 'ozz' }),
    );
    expect(form.updatePantryItemFields).not.toHaveBeenCalled();
  });
});

it('says a save failed when a write breaks, and keeps the form open', async () => {
  const form = renderSave({ dirtyFields: { quantityInput: true } });
  form.updateQuantity.mockRejectedValueOnce(new Error('boom'));

  await form.save({ quantityInput: '3' });

  expect(alertService.alert).toHaveBeenCalledWith(
    t('labels.error'),
    t('itemForm.updateFailed'),
  );
  expect(form.onSuccess).not.toHaveBeenCalled();
});

describe('a unit change', () => {
  /** Saves, waits for the change to be asked, and answers it. */
  async function saveAnswering(
    form: ReturnType<typeof renderSave>,
    data: Partial<PantryItemFormData>,
    answer: 'cancel' | 'confirm' = 'confirm',
  ) {
    const asked = nextAlert();
    const saving = form.save(data);
    const { message, buttons } = await asked;
    await act(async () => {
      pressed(buttons, answer);
      await saving;
    });
    return message;
  }

  // A stack set to "1" holds exactly 1, not the 0.999996 it rounds.
  it('is previewed at the amount the field shows, and closes once made', async () => {
    const form = renderSave({
      existingPantryItem: stackHolding({ quantity: 0.999996 }),
      trackingUnit: selection(KG),
      dirtyFields: { unit: true },
    });

    await saveAnswering(form, { unit: 'kg', quantityInput: '1' });

    expect(form.preview).toHaveBeenCalledWith({
      unitId: 'unit-kg',
      resolution: PantryUnitChangeResolution.Recount,
      quantity: 1,
    });
    expect(form.change).toHaveBeenCalledTimes(1);
    expect(form.updateQuantity).not.toHaveBeenCalled();
    expect(form.onSuccess).toHaveBeenCalledTimes(1);
  });

  it('offers the net weight as one package when the server asks for it', async () => {
    const answer = previewing({ quantity: 2, unit: LITRE }, KG);
    const form = renderSave({
      trackingUnit: selection(KG),
      dirtyFields: { unit: true },
      netWeightUnitId: 'unit-oz',
      preview: async request => {
        const outcome = await answer(request);
        return request.resolution ||
          request.packageSize ||
          outcome.status !== 'ready'
          ? outcome
          : {
              ...outcome,
              preview: {
                ...outcome.preview,
                refusal: {
                  __typename: 'PantryUnitChangeRefusal',
                  code: ErrorCode.ValidationFailed,
                  field: 'packageSize',
                },
              },
            };
      },
    });

    await saveAnswering(form, {
      unit: 'kg',
      netWeight: '32',
      netWeightUnit: 'oz',
    });

    expect(form.preview).toHaveBeenCalledWith({
      unitId: 'unit-kg',
      packageSize: { netWeight: 32, netWeightUnitId: 'unit-oz' },
    });
  });

  it('asks against how the stack reads now', async () => {
    const form = renderSave({
      existingPantryItem: stackHolding({
        quantity: 12,
        held: PIECE,
        shown: { quantity: 1, unit: DOZEN },
      }),
      trackingUnit: selection(PIECE),
      dirtyFields: { unit: true },
      preview: previewing({ quantity: 12, unit: PIECE }, PIECE),
    });

    const asked = await saveAnswering(form, {
      unit: 'pc',
      quantityInput: '12',
    });

    expect(asked).toContain(
      t('unitChange.beforeAfter', { before: '1 doz', after: '12 pc' }),
    );
  });

  it('saves the other edits once made, never the unit itself', async () => {
    const form = renderSave({
      trackingUnit: selection(KG),
      dirtyFields: { unit: true, notes: true },
    });

    await saveAnswering(form, { unit: 'kg', notes: 'Top shelf' });

    expect(form.updatePantryItemFields).toHaveBeenCalledWith(
      expect.objectContaining({ dirtyFields: { notes: true } }),
    );
  });

  it('saves nothing else, and keeps the form open, when not made', async () => {
    const form = renderSave({
      trackingUnit: selection(KG),
      dirtyFields: { unit: true, notes: true },
    });

    await saveAnswering(form, { unit: 'kg', notes: 'Top shelf' }, 'cancel');

    expect(form.change).not.toHaveBeenCalled();
    expect(form.updatePantryItemFields).not.toHaveBeenCalled();
    expect(form.onSuccess).not.toHaveBeenCalled();
  });

  it('resolves a typed unit before changing to it', async () => {
    const form = renderSave({
      trackingUnit: { id: null, name: null, symbol: null, type: null },
      units: { sticks: 'unit-stick' },
    });

    await saveAnswering(form, { unit: 'sticks' });

    expect(form.preview).toHaveBeenCalledWith({ unitId: 'unit-stick' });
  });

  it('reports a typed unit it cannot resolve on its field, sending nothing', async () => {
    const form = renderSave({
      trackingUnit: { id: null, name: null, symbol: null, type: null },
    });

    await form.save({ unit: 'sticks of' });

    expect(form.reportFieldError).toHaveBeenCalledWith(
      'unit',
      t('itemForm.unknownUnit', { unit: 'sticks of' }),
    );
    expect(form.preview).not.toHaveBeenCalled();
  });
});

// The server bumps the version on every write and refuses a stale one, so
// the field write must read the version the amount's write returned.
it('stores an amount and a notes edit made together, with no version conflict', async () => {
  let serverVersion = 1;
  const sentVersion = (variables: Record<string, unknown>) => {
    const { input } = variables;
    return typeof input === 'object' && input !== null && 'version' in input
      ? input.version
      : null;
  };
  const quantity = recordMock(UpdatePantryItemQuantityDocument, {
    dataFor: (vars): MockDataFor<typeof UpdatePantryItemQuantityDocument> => {
      if (sentVersion(vars) !== serverVersion) {
        return {
          updatePantryItemQuantity: {
            __typename: 'ConflictError',
            code: ErrorCode.VersionConflict,
          },
        };
      }
      serverVersion += 1;
      return {
        updatePantryItemQuantity: {
          __typename: 'UpdatePantryItemQuantityPayload',
          pantryItem: { id: STACK, quantity: 3, version: serverVersion },
        },
      };
    },
  });
  const fields = recordMock(UpdatePantryItemDocument, {
    dataFor: (vars): MockDataFor<typeof UpdatePantryItemDocument> => {
      if (sentVersion(vars) !== serverVersion) {
        return {
          updatePantryItem: {
            __typename: 'ConflictError',
            code: ErrorCode.VersionConflict,
          },
        };
      }
      serverVersion += 1;
      return {
        updatePantryItem: {
          __typename: 'UpdatePantryItemPayload',
          pantryItem: {
            id: STACK,
            quantity: 3,
            storageNotes: 'Top shelf',
            version: serverVersion,
          },
        },
      };
    },
  });
  const cache = makeCache();
  seedFragment(cache, {
    fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
    fragmentName: 'useUpdatePantryItem_pantryItem',
    id: `PantryItem:${STACK}`,
    data: {
      __typename: 'PantryItem',
      id: STACK,
      version: 1,
      quantity: 2,
      unit: LITRE,
      storageNotes: null,
    },
  });
  const onSuccess = jest.fn();
  const { result } = renderHookWithApollo(
    () =>
      usePantryItemFormSubmit({
        itemId: STACK,
        currentPantryId: 'pantry-1',
        existingPantryItem: stackHolding({ quantity: 2 }),
        dirtyFields: { quantityInput: true, notes: true },
        trackingUnit: selection(LITRE),
        netWeightUnitId: null,
        selectedLocationId: null,
        selectedBrandId: null,
        selectedStorageLocation: null,
        updatePantryItemFields: useUpdatePantryItem({}).updatePantryItemFields,
        updateQuantity: useUpdatePantryItemQuantity({}).updateQuantity,
        resolveUnitId: async () => null,
        unitChange: {
          preview: async () => ({ status: 'failed' }),
          change: async () => ({ status: 'changed' }),
        },
        reportFieldError: jest.fn(),
        onSuccess,
      }),
    { cache, operationMocks: [quantity.mock, fields.mock] },
  );

  await act(async () => {
    await result.current.handleSave({
      ...FORM,
      quantityInput: '3',
      notes: 'Top shelf',
    });
  });

  expect(
    cache.readFragment({
      fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
      fragmentName: 'useUpdatePantryItem_pantryItem',
      id: `PantryItem:${STACK}`,
    }),
  ).toMatchObject({ quantity: 3, storageNotes: 'Top shelf', version: 3 });
  expect(alertService.alert).not.toHaveBeenCalled();
  expect(onSuccess).toHaveBeenCalledTimes(1);
});
