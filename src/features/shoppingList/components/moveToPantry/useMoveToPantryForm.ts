import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useTranslation } from '#/i18n';
import { StorageState, type UnitType } from '#/graphql/generated/schemaTypes';
import { useResolveUnit } from '#features/catalog/hooks/useResolveUnit';
import type { MoveToPantryInput } from '#features/shoppingList/hooks/useMoveToPantry';
import {
  shownUnitPrice,
  totalFromUnitPrice,
} from '#features/shoppingList/utils/purchasePrice';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantityForInput, unitLabel } from '#/utils/formatQuantity';
import { formatNumberForInput } from '#/utils/formatters/number';
import { isOwnKey } from '#utils/isOwnKey';
import {
  parseMoneyInput,
  reportValidationErrors,
} from '#/utils/validation/common';
import { buildMoveToPantryInput } from './buildMoveToPantryInput';
import {
  moveToPantryDefaults,
  moveToPantrySchema,
  type MoveToPantryFormValues,
} from './moveToPantryFormConfig';
import type { useMoveToPantryItem } from './useMoveToPantryItem';

type MoveItem = ReturnType<typeof useMoveToPantryItem>;

/** The line being moved, once its read has landed. */
export type LoadedMoveItem = MoveItem & {
  shoppingListItem: NonNullable<MoveItem['shoppingListItem']>;
};

interface UseMoveToPantryFormOptions {
  moveItem: LoadedMoveItem;
  selectedPantryId: string | null;
  askPrice: boolean;
  /** Resolves true once the move is applied or queued. */
  onConfirm: (input: MoveToPantryInput) => Promise<boolean>;
  onClose: () => void;
}

/**
 * One opening's form, seeded from the line and what was bought; amounts that
 * land after it opens are seeded then, never over something typed.
 */
export function useMoveToPantryForm({
  moveItem,
  selectedPantryId,
  askPrice,
  onConfirm,
  onClose,
}: UseMoveToPantryFormOptions) {
  const { t } = useTranslation();
  const {
    shoppingListItem,
    purchasedQuantity,
    purchasedUnitPrice,
    purchasedUnit,
  } = moveItem;

  // What the amounts are seeded from: what was BOUGHT, falling back to what was
  // requested. Prefilling the request is how a line asked for as 1 piece and
  // bought as 5 reached the pantry as 1.
  const seedQuantity = purchasedQuantity ?? shoppingListItem.quantity;

  // ONE source decides both halves. Separate fallback chains let a line with
  // free-text `unitName` show "bag" while submitting the purchase's unit id.
  const resolvedUnit = shoppingListItem.unit
    ? {
        label: unitLabel(shoppingListItem.unit),
        id: shoppingListItem.unit.id,
        type: shoppingListItem.unit.type,
      }
    : shoppingListItem.unitName
    ? { label: shoppingListItem.unitName, id: null, type: null }
    : purchasedUnit
    ? {
        label: purchasedUnit.unitSymbol,
        id: purchasedUnit.unit.id,
        type: purchasedUnit.unit.type,
      }
    : { label: '', id: null, type: null };

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    trigger,
    getFieldState,
    setError,
    formState: { errors },
  } = useForm<MoveToPantryFormValues>({
    resolver: yupResolver(moveToPantrySchema),
    defaultValues: {
      ...moveToPantryDefaults(StorageState.Ambient),
      quantityInput: formatQuantityForInput(seedQuantity) || '1',
      unitValue: resolvedUnit.label,
      unitId: resolvedUnit.id,
      unitType: resolvedUnit.type,
      pantryId: selectedPantryId,
      actualPriceInput: formatNumberForInput(
        totalFromUnitPrice(purchasedUnitPrice, seedQuantity ?? 1),
      ),
    },
    mode: 'onTouched',
  });

  // `useWatch` rather than `watch`: the latter returns a function the React
  // Compiler cannot memoize safely, which is a lint error here.
  const quantityInput = useWatch({ control, name: 'quantityInput' });
  const actualPriceInput = useWatch({ control, name: 'actualPriceInput' });
  const unitValue = useWatch({ control, name: 'unitValue' });
  const unitId = useWatch({ control, name: 'unitId' });
  const pantryId = useWatch({ control, name: 'pantryId' });
  const expirationDate = useWatch({ control, name: 'expirationDate' });

  // Interaction state, not fields: the per-unit price the total was seeded
  // from, and whether the shopper has typed over either amount, decide which
  // survives an edit (`changeQuantity`).
  const [seededUnitPrice, setSeededUnitPrice] = useState(purchasedUnitPrice);
  // The unit that price is per: the line's, else the purchase's.
  const [seededUnit, setSeededUnit] = useState<{
    id: string | null;
    label: string;
  } | null>({ id: resolvedUnit.id, label: resolvedUnit.label });
  const [amountsTouched, setAmountsTouched] = useState(false);
  const [priceTouched, setPriceTouched] = useState(false);

  // `setValue` notifies mounted `Controller` children synchronously, so the
  // seed is accumulated here and applied from an effect — writing it during
  // render updates components that are not rendering.
  const [pendingSeed, setPendingSeed] =
    useState<Partial<MoveToPantryFormValues> | null>(null);
  let seedThisPass: Partial<MoveToPantryFormValues> | null = null;

  // A cold start has no cached purchase, so the amounts can land a beat after
  // the sheet opens. Seed them then too — but never over something typed.
  const seedKey = `${purchasedQuantity ?? ''}|${purchasedUnitPrice ?? ''}|${
    purchasedUnit?.unit.id ?? ''
  }`;
  // The amounts the form opened on are already in its defaults.
  const [prevSeed, setPrevSeed] = useState(seedKey);
  if (seedKey !== prevSeed) {
    setPrevSeed(seedKey);
    // A line with no unit of its own takes the purchase's, which arrives with
    // the amounts rather than with the fragment.
    if (!unitId && purchasedUnit) {
      seedThisPass = {
        unitValue: purchasedUnit.unitSymbol,
        unitId: purchasedUnit.unit.id,
        unitType: purchasedUnit.unit.type,
      };
      setSeededUnit({
        id: purchasedUnit.unit.id,
        label: purchasedUnit.unitSymbol,
      });
    }
    if (!amountsTouched && purchasedQuantity != null) {
      seedThisPass = {
        ...seedThisPass,
        quantityInput: formatQuantityForInput(purchasedQuantity) || '1',
        actualPriceInput: formatNumberForInput(
          totalFromUnitPrice(purchasedUnitPrice, purchasedQuantity),
        ),
      };
      setSeededUnitPrice(purchasedUnitPrice);
    }
  }

  if (seedThisPass) setPendingSeed(seedThisPass);

  useEffect(() => {
    if (!pendingSeed) return;
    for (const field of Object.keys(pendingSeed)) {
      if (isOwnKey(pendingSeed, field)) setValue(field, pendingSeed[field]);
    }
  }, [pendingSeed, setValue]);

  const paidInSeededUnit = (id: string | null, text: string) => {
    if (seededUnit === null) return false;
    if (id !== null) return id === seededUnit.id;
    return seededUnit.id === null && text.trim() === seededUnit.label;
  };

  // A quantity edit holds the PER-UNIT price and re-derives the total (3 of 5
  // at $0.59 records $1.77), but only in the unit it was paid in; in another,
  // the purchase cost what it cost. A total the shopper typed wins.
  const reprice = (quantity: string, id: string | null, unitText: string) => {
    if (priceTouched || seededUnitPrice == null) return;
    if (!paidInSeededUnit(id, unitText)) {
      setValue(
        'actualPriceInput',
        formatNumberForInput(
          totalFromUnitPrice(seededUnitPrice, seedQuantity ?? 1),
        ),
      );
      return;
    }
    const parsed = parseFractionalInput(quantity);
    const usable = parsed !== null && !isNaN(parsed) && parsed > 0;
    setValue(
      'actualPriceInput',
      usable
        ? formatNumberForInput(totalFromUnitPrice(seededUnitPrice, parsed))
        : '',
    );
  };

  // A unit typed and not picked goes as the unit it names, from the units the
  // device holds as it is typed (`cartoon` names carton), else from the API on
  // confirm. Its text then reads as that unit.
  const { heldUnitFor, resolveUnit } = useResolveUnit();
  // A keystroke drops the pick: the text then names a unit the device holds,
  // or none.
  const pickedOrHeld = (
    picked: string | null,
    pickedType: UnitType | null | undefined,
    text: string,
  ) => {
    const held = picked ? null : heldUnitFor(text);
    return {
      id: picked ?? held?.id ?? null,
      type: pickedType ?? held?.type ?? null,
    };
  };
  const unitNamed = async (text: string, id: string | null) => {
    if (!text.trim()) return null;
    if (!id) return resolveUnit(text);
    const held = heldUnitFor(text);
    return held?.id === id ? held : null;
  };
  const resolveTypedUnits = async () => {
    const values = getValues();
    const unit = await unitNamed(values.unitValue, values.unitId);
    if (unit) {
      setValue('unitId', unit.id);
      setValue('unitType', unit.type);
      setValue('unitValue', unit.label);
      reprice(values.quantityInput, unit.id, unit.label);
    }
    const size = await unitNamed(
      values.packageSizeUnitValue,
      values.packageSizeUnitId,
    );
    if (size) {
      setValue('packageSizeUnitId', size.id);
      setValue('packageSizeUnitType', size.type);
      setValue('packageSizeUnitValue', size.label);
    }
  };

  // Reaching here means the schema passed, so every field rule has already
  // reported itself ON its own field; what is still missing is reported on
  // its field too.
  const [isMoving, setIsMoving] = useState(false);
  const onValid = async (values: MoveToPantryFormValues) => {
    const built = buildMoveToPantryInput(values, askPrice);
    if ('missing' in built) {
      setError(built.missing.field, { message: t(built.missing.key) });
      return;
    }
    setIsMoving(true);
    const moved = await onConfirm(built.input);
    setIsMoving(false);
    if (moved) onClose();
  };

  return {
    control,
    errors,
    quantityInput,
    unitValue,
    pantryId,
    expirationDate,
    actualPriceInput,
    /** The same resolution the fields use, so it never renders empty. */
    lineUnitLabel: resolvedUnit.label,
    perUnitPrice: shownUnitPrice(
      parseMoneyInput(actualPriceInput),
      parseFractionalInput(quantityInput),
    ),
    isMoving,
    submit: () => {
      void resolveTypedUnits().then(() =>
        handleSubmit(onValid, reportValidationErrors)(),
      );
    },
    changeQuantity: (value: string) => {
      setValue('quantityInput', value);
      // The size's count rule reads the quantity. Re-run only a refusal already
      // shown, so a fix clears it without a half-typed count raising a new one.
      if (getFieldState('packageSizeInput').invalid) {
        void trigger('packageSizeInput');
      }
      setAmountsTouched(true);
      reprice(value, getValues('unitId'), getValues('unitValue'));
    },
    changePrice: (value: string) => {
      // Re-run only a refusal already shown, so a fix clears it.
      setValue('actualPriceInput', value, {
        shouldValidate: getFieldState('actualPriceInput').invalid,
      });
      setAmountsTouched(true);
      setPriceTouched(true);
    },
    changeUnitText: (value: string) =>
      setValue('unitValue', value, { shouldValidate: true }),
    selectUnit: (picked: string | null, pickedType?: UnitType | null) => {
      const unit = pickedOrHeld(picked, pickedType, getValues('unitValue'));
      setValue('unitId', unit.id);
      setValue('unitType', unit.type);
      reprice(getValues('quantityInput'), unit.id, getValues('unitValue'));
      void trigger('packageSizeInput');
      // The rule reports on the TEXT while reading the id, and the field
      // clears the id after writing the text — so without this the emptied
      // field carries no message.
      void trigger('unitValue');
    },
    /** The size's unit rule reads the size, so a size edit re-runs it. */
    sizeChanged: () => {
      void trigger('packageSizeUnitValue');
    },
    selectSizeUnit: (picked: string | null, pickedType?: UnitType | null) => {
      const held = pickedOrHeld(
        picked,
        pickedType,
        getValues('packageSizeUnitValue'),
      );
      setValue('packageSizeUnitId', held.id);
      setValue('packageSizeUnitType', held.type);
      void trigger('packageSizeUnitValue');
      // The size's count rule reads the size's unit too.
      if (getFieldState('packageSizeInput').invalid) {
        void trigger('packageSizeInput');
      }
    },
    selectPantry: (id: string) =>
      setValue('pantryId', id, { shouldValidate: true }),
    changeExpiry: (date: Date | null) =>
      setValue('expirationDate', date ?? undefined),
  };
}
