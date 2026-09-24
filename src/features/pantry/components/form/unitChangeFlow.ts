import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { isTranslationKey, t } from '#/i18n';
import {
  ErrorCode,
  PantryUnitChangeMethod,
  PantryUnitChangeResolution,
} from '#/graphql/generated/schemaTypes';
import {
  formatQuantityForDisplay,
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
 * - `estimate`: the route is approximate, so the estimate or their own amount;
 * - `recount`: no route, so their amount in the new unit;
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
type Choice = Pick<UnitChangeRequest, 'resolution' | 'quantity'>;

export interface UnitChangeDeps {
  preview: (request: ChangeRequest) => Promise<PreviewOutcome>;
  change: (
    request: ChangeRequest & { version: number },
  ) => Promise<ChangeOutcome>;
  reportFieldError: (field: UnitChangeField, message: string) => void;
}

export interface UnitChangeTarget {
  unitId: string;
  /** The amount the form holds, read as the stack in the new unit. */
  quantity: number | null;
  /** The form's net weight: one package, for a measure becoming a count. */
  packageSize?: PackageSize;
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
  if (preview.quantityIgnored) lines.push(t('unitChange.quantityIgnored'));
  return [...lines, ...consequences(preview)].join('\n');
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

/** The app's alert, resolving with the chosen value, or null on Cancel. */
function ask<T>(
  message: string,
  choices: ReadonlyArray<{ label: string; value: T }>,
): Promise<T | null> {
  return new Promise(resolve => {
    alertService.alert(t('unitChange.title'), message, [
      {
        text: t('labels.cancel'),
        style: 'cancel',
        onPress: () => resolve(null),
      },
      ...choices.map(choice => ({
        text: choice.label,
        onPress: () => resolve(choice.value),
      })),
    ]);
  });
}

/** What the user confirms for this preview, or null when there is nothing to send. */
async function decide(
  deps: UnitChangeDeps,
  preview: UnitChangePreview,
  target: UnitChangeTarget,
  notice: string | null,
): Promise<Choice | null> {
  const { fromUnit, toUnit } = preview;
  const withNotice = (message: string) =>
    notice ? `${notice}\n\n${message}` : message;

  switch (unitChangeMode(preview)) {
    case 'refused':
      deps.reportFieldError('unit', refusalText(preview));
      return null;
    case 'packageSize':
      deps.reportFieldError(
        'netWeight',
        t('unitChange.packageSizeNeeded', { unit: toUnit.symbol }),
      );
      return null;
    case 'recount':
      deps.reportFieldError(
        'quantityInput',
        t('unitChange.noRoute', { from: fromUnit.symbol, to: toUnit.symbol }),
      );
      return null;
    case 'estimate': {
      const lines = [
        t('unitChange.estimateChoice', {
          from: fromUnit.symbol,
          to: toUnit.symbol,
        }),
        ...(target.quantity === null ? [t('unitChange.enterAmountHint')] : []),
        ...consequences(preview),
      ];
      return ask<Choice>(withNotice(lines.join('\n')), [
        {
          label: t('unitChange.useEstimate', {
            amount: amountText(preview.quantityAfter, toUnit),
          }),
          value: { resolution: PantryUnitChangeResolution.Convert },
        },
        ...(target.quantity === null
          ? []
          : [
              {
                label: t('unitChange.useMyAmount', {
                  amount: amountText(target.quantity, toUnit),
                }),
                value: {
                  resolution: PantryUnitChangeResolution.Recount,
                  quantity: target.quantity,
                },
              },
            ]),
      ]);
    }
    case 'summary':
      return ask<Choice>(withNotice(summaryMessage(preview)), [
        {
          label: t('unitChange.title'),
          // A recount carries the amount it was previewed with.
          value:
            preview.method === PantryUnitChangeMethod.Recount
              ? {
                  resolution: PantryUnitChangeResolution.Recount,
                  quantity: target.quantity ?? undefined,
                }
              : {},
        },
      ]);
  }
}

/** Retries a stack that moved on since its preview, then gives up. */
const MAX_PREVIEWS = 3;

/**
 * Previews moving the stack onto `target.unitId`, asks the user to confirm in
 * the app's alert, and makes the change. Anything the user has to supply is
 * reported on the form field that takes it. Resolves true once changed.
 */
export async function runUnitChange(
  deps: UnitChangeDeps,
  target: UnitChangeTarget,
): Promise<boolean> {
  const base: ChangeRequest = {
    unitId: target.unitId,
    quantity: target.quantity ?? undefined,
  };

  const attempt = async (
    request: ChangeRequest,
    notice: string | null,
    previews: number,
  ): Promise<boolean> => {
    const outcome = await deps.preview(request);
    if (outcome.status !== 'ready') {
      deps.reportFieldError(
        'unit',
        t(
          outcome.status === 'offline'
            ? 'unitChange.needsConnection'
            : 'unitChange.previewFailed',
        ),
      );
      return false;
    }
    const { preview } = outcome;
    // One package's size is the form's net weight, sent only when asked for.
    if (
      unitChangeMode(preview) === 'packageSize' &&
      !request.packageSize &&
      target.packageSize
    ) {
      return attempt(
        { ...request, packageSize: target.packageSize },
        notice,
        previews + 1,
      );
    }

    const choice = await decide(deps, preview, target, notice);
    if (!choice) return false;

    const result = await deps.change({
      ...request,
      ...choice,
      version: preview.version,
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
    return attempt(request, t('unitChange.changedMeanwhile'), previews + 1);
  };

  return attempt(base, null, 1);
}
