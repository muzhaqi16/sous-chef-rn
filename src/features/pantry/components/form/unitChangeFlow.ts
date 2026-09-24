import { alertService, type AlertButton } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { isTranslationKey, t } from '#/i18n';
import {
  ErrorCode,
  PantryUnitChangeMethod,
  PantryUnitChangeResolution,
} from '#/graphql/generated/schemaTypes';
import {
  formatQuantityForDisplay,
  isUnchangedQuantity,
  resolveQuantityNotation,
} from '#/utils/formatQuantity';
import type {
  ChangeOutcome,
  PreviewOutcome,
  UnitChangePreview,
  UnitChangeRequest,
} from '#features/pantry/hooks/usePantryUnitChange';

/**
 * What a preview asks of the user:
 * - `summary`: nothing — confirm the before and after;
 * - `estimate`: the route is approximate, so the estimate or an amount;
 * - `recount`: no route, so an amount in the new unit;
 * - `packageSize`: a measure becoming a count, so the size of one package;
 * - `refused`: the change cannot be made; the reason is shown.
 */
type UnitChangeMode =
  | 'summary'
  | 'estimate'
  | 'recount'
  | 'packageSize'
  | 'refused';

/** @internal Test seam. */
export function unitChangeMode(preview: UnitChangePreview): UnitChangeMode {
  const { refusal } = preview;
  if (preview.conflictingPantryItemId) return 'refused';
  if (refusal?.field === 'packageSize') return 'packageSize';
  if (refusal?.code === ErrorCode.UnitChangeNeedsResolution) return 'estimate';
  if (preview.method === null) {
    return !refusal || refusal.field === 'quantity' ? 'recount' : 'refused';
  }
  return refusal ? 'refused' : 'summary';
}

/** The form fields a unit change reports on. */
export type UnitChangeField = 'unit' | 'quantityInput' | 'netWeight';

type PackageSize = NonNullable<UnitChangeRequest['packageSize']>;
type ChangeRequest = Omit<UnitChangeRequest, 'pantryItemId'>;

export interface UnitChangeDeps {
  preview: (request: ChangeRequest) => Promise<PreviewOutcome>;
  change: (
    request: ChangeRequest & { version: number },
  ) => Promise<ChangeOutcome>;
  reportFieldError: (field: UnitChangeField, message: string) => void;
}

export interface UnitChangeTarget {
  unitId: string;
  /** The form's Current Quantity: set as what the stack holds in the new unit. */
  amount: number;
  /** The form's net weight: one package, for a measure becoming a count. */
  packageSize?: PackageSize;
}

/** A request and what the server says it would do. */
interface Option {
  request: ChangeRequest;
  preview: UnitChangePreview;
}

type PreviewUnit = UnitChangePreview['toUnit'];

const amountText = (quantity: number | null | undefined, unit: PreviewUnit) =>
  `${formatQuantityForDisplay(quantity, {
    notation: resolveQuantityNotation(null, unit.displayAsFraction),
  })} ${unit.symbol}`;

const beforeAfter = (
  before: number | null | undefined,
  after: number | null | undefined,
  preview: UnitChangePreview,
) =>
  t('unitChange.beforeAfter', {
    before: amountText(before, preview.fromUnit),
    after: amountText(after, preview.toUnit),
  });

/** What the change leaves behind, one line each. */
function consequences(preview: UnitChangePreview): string[] {
  const lines: string[] = [];
  if (preview.batches.length > 1) {
    lines.push(
      t('unitChange.batches'),
      ...preview.batches.map(batch =>
        beforeAfter(batch.quantityBefore, batch.quantityAfter, preview),
      ),
    );
  }
  if (preview.dropsNetWeight) lines.push(t('unitChange.dropsNetWeight'));
  if (preview.dropsPortions) lines.push(t('unitChange.dropsPortions'));
  if (preview.dropsThresholds) {
    lines.push(t('unitChange.dropsThresholds'));
  } else if (preview.minQuantityAfter != null) {
    lines.push(
      t('unitChange.alertBelowAfter', {
        amount: amountText(preview.minQuantityAfter, preview.toUnit),
      }),
    );
  }
  return lines;
}

function summaryMessage(preview: UnitChangePreview): string {
  const lines = [
    beforeAfter(preview.quantityBefore, preview.quantityAfter, preview),
  ];
  if (preview.method === PantryUnitChangeMethod.Recount) {
    lines.push(t('unitChange.recountNote'));
  } else if (preview.exact !== null) {
    lines.push(t(preview.exact ? 'unitChange.exact' : 'unitChange.estimate'));
  }
  return [...lines, ...consequences(preview)].join('\n');
}

/** The lead lines, then what each choice leaves behind: once when they agree. */
function choiceMessage(
  lead: string[],
  converted: UnitChangePreview | null,
  set: Option,
  amount: string,
): string {
  const afterSet = consequences(set.preview);
  const afterConvert = converted ? consequences(converted) : [];
  if (!converted || afterSet.join() === afterConvert.join()) {
    return [...lead, ...afterSet].join('\n');
  }
  return [
    ...lead,
    ...(afterSet.length
      ? [t('unitChange.ifSet', { amount }), ...afterSet]
      : []),
    ...(afterConvert.length
      ? [t('unitChange.ifConverted'), ...afterConvert]
      : []),
  ].join('\n');
}

function refusalText(preview: UnitChangePreview): string {
  if (preview.conflictingPantryItemId) {
    return t('unitChange.conflicting', { unit: preview.toUnit.symbol });
  }
  const field = preview.refusal?.field;
  const fieldKey = `errors.field.${field ?? ''}`;
  if (field && isTranslationKey(fieldKey)) return t(fieldKey);
  return errorService.getUserFriendlyMessage(
    preview.refusal?.code ?? '',
    t('unitChange.failed'),
  );
}

/** The form field a refusal of `field` belongs on. */
function formFieldOf(field: string | null): UnitChangeField {
  if (field === 'quantity') return 'quantityInput';
  if (field === 'packageSize') return 'netWeight';
  return 'unit';
}

/**
 * The app's alert, resolving with the chosen value, or null on Cancel. Cancel
 * leads a row of two and closes a stack of three.
 */
function ask<T>(
  message: string,
  choices: ReadonlyArray<{ label: string; value: T }>,
): Promise<T | null> {
  return new Promise(resolve => {
    const cancel: AlertButton = {
      text: t('labels.cancel'),
      style: 'cancel',
      onPress: () => resolve(null),
    };
    const buttons = choices.map(
      (choice): AlertButton => ({
        text: choice.label,
        onPress: () => resolve(choice.value),
      }),
    );
    alertService.alert(
      t('unitChange.title'),
      message,
      buttons.length > 1 ? [...buttons, cancel] : [cancel, ...buttons],
    );
  });
}

/**
 * What the user picks: converting the stock (`convert`), or setting it to the
 * form's amount (`set`, absent when the server would not take it). Null when
 * there is nothing to send; anything to supply is reported on its field.
 */
async function decide(
  deps: UnitChangeDeps,
  convert: Option,
  set: Option | null,
  target: UnitChangeTarget,
  notice: string | null,
): Promise<Option | null> {
  const { preview } = convert;
  const { fromUnit, toUnit } = preview;
  const amount = amountText(target.amount, toUnit);
  const withNotice = (message: string) =>
    notice ? `${notice}\n\n${message}` : message;
  const setChoice = set && {
    label: t('unitChange.setTo', { amount }),
    value: set,
  };
  const setOrConvert = t('unitChange.setOrConvert', {
    amount,
    before: amountText(preview.quantityBefore, fromUnit),
  });

  switch (unitChangeMode(preview)) {
    case 'refused':
      deps.reportFieldError('unit', refusalText(preview));
      return null;
    case 'packageSize': {
      const packageSizeNeeded = t('unitChange.packageSizeNeeded', {
        unit: toUnit.symbol,
      });
      if (!setChoice) {
        deps.reportFieldError('netWeight', packageSizeNeeded);
        return null;
      }
      const picked = await ask<Option | 'packageSize'>(
        withNotice(
          choiceMessage(
            [t('unitChange.packageSizeOrSet', { unit: toUnit.symbol, amount })],
            null,
            setChoice.value,
            amount,
          ),
        ),
        [
          setChoice,
          { label: t('unitChange.enterPackageSize'), value: 'packageSize' },
        ],
      );
      if (picked !== 'packageSize') return picked;
      deps.reportFieldError('netWeight', packageSizeNeeded);
      return null;
    }
    case 'recount':
      if (!setChoice) {
        deps.reportFieldError(
          'quantityInput',
          t('unitChange.noRoute', { from: fromUnit.symbol, to: toUnit.symbol }),
        );
        return null;
      }
      return ask(withNotice(summaryMessage(setChoice.value.preview)), [
        { label: t('unitChange.title'), value: setChoice.value },
      ]);
    case 'estimate': {
      const estimate = {
        label: t('unitChange.convertToAbout', {
          amount: amountText(preview.quantityAfter, toUnit),
        }),
        value: {
          ...convert,
          request: {
            ...convert.request,
            resolution: PantryUnitChangeResolution.Convert,
          },
        },
      };
      const lead = [
        t('unitChange.estimateChoice', {
          from: fromUnit.symbol,
          to: toUnit.symbol,
        }),
      ];
      if (!setChoice) {
        return ask(withNotice([...lead, ...consequences(preview)].join('\n')), [
          estimate,
        ]);
      }
      return ask(
        withNotice(
          choiceMessage(
            [...lead, setOrConvert],
            preview,
            setChoice.value,
            amount,
          ),
        ),
        [setChoice, estimate],
      );
    }
    case 'summary': {
      const sameAmount =
        preview.quantityAfter != null &&
        isUnchangedQuantity(target.amount, preview.quantityAfter);
      if (!setChoice || sameAmount) {
        // Landing on the field's amount, the stack holds exactly it: a
        // converted 0.999996 doz is 11.99995 pc, not the 12 shown.
        const exactly =
          setChoice &&
          consequences(setChoice.value.preview).join() ===
            consequences(preview).join()
            ? setChoice.value
            : convert;
        return ask(withNotice(summaryMessage(preview)), [
          { label: t('unitChange.title'), value: exactly },
        ]);
      }
      return ask(
        withNotice(
          choiceMessage([setOrConvert], preview, setChoice.value, amount),
        ),
        [
          setChoice,
          {
            label: t('unitChange.convertTo', {
              amount: amountText(preview.quantityAfter, toUnit),
            }),
            value: convert,
          },
        ],
      );
    }
  }
}

async function previewed(
  deps: UnitChangeDeps,
  request: ChangeRequest,
): Promise<Option | PreviewOutcome['status']> {
  const outcome = await deps.preview(request);
  return outcome.status === 'ready'
    ? { request, preview: outcome.preview }
    : outcome.status;
}

/** Retries a stack that moved on since its preview, then gives up. */
const MAX_PREVIEWS = 3;

/**
 * Previews moving the stack onto `target.unitId` both ways — converted, and set
 * to the form's amount — asks the user in the app's alert, and makes the
 * change. Anything the user has to supply is reported on the form field that
 * takes it. Resolves true once changed.
 */
export async function runUnitChange(
  deps: UnitChangeDeps,
  target: UnitChangeTarget,
): Promise<boolean> {
  const setRequest: ChangeRequest = {
    unitId: target.unitId,
    resolution: PantryUnitChangeResolution.Recount,
    quantity: target.amount,
  };

  const attempt = async (
    notice: string | null,
    previews: number,
  ): Promise<boolean> => {
    const [first, setPreview] = await Promise.all([
      previewed(deps, { unitId: target.unitId }),
      previewed(deps, setRequest),
    ]);
    let convert = first;
    // One package's size is the form's net weight, sent only when asked for.
    if (
      typeof convert !== 'string' &&
      unitChangeMode(convert.preview) === 'packageSize' &&
      target.packageSize
    ) {
      convert = await previewed(deps, {
        unitId: target.unitId,
        packageSize: target.packageSize,
      });
    }
    if (typeof convert === 'string') {
      deps.reportFieldError(
        'unit',
        t(
          convert === 'offline'
            ? 'unitChange.needsConnection'
            : 'unitChange.previewFailed',
        ),
      );
      return false;
    }
    // An empty stack takes no amount: the server ignores it.
    const set =
      typeof setPreview !== 'string' &&
      unitChangeMode(setPreview.preview) === 'summary' &&
      !setPreview.preview.quantityIgnored
        ? setPreview
        : null;

    const chosen = await decide(deps, convert, set, target, notice);
    if (!chosen) return false;

    const result = await deps.change({
      ...chosen.request,
      version: chosen.preview.version,
    });
    if (result.status === 'changed') return true;
    if (result.status === 'failed') {
      deps.reportFieldError(formFieldOf(result.field), result.message);
      return false;
    }
    if (previews >= MAX_PREVIEWS) {
      deps.reportFieldError('unit', t('unitChange.failed'));
      return false;
    }
    return attempt(t('unitChange.changedMeanwhile'), previews + 1);
  };

  return attempt(null, 1);
}
