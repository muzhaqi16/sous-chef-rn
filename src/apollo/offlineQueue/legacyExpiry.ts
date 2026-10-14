import type { OperationVariables } from '@apollo/client';
import { Kind, type DocumentNode, type TypeNode } from 'graphql';
import { isRecord } from '#/utils/isRecord';
import { toDateKey } from '#/utils/dateUtils';
import { isOwnKey } from '#/utils/isOwnKey';

/** The inputs whose `expiresAt` became `expiresOn`; an invite's is still an instant. */
const DATE_ONLY_EXPIRY_INPUTS = new Set([
  'CreatePantryItemInput',
  'UpdatePantryItemInput',
  'RestockPantryItemInput',
  'MoveShoppingItemToPantryInput',
]);

const namedType = (type: TypeNode): string =>
  type.kind === Kind.NAMED_TYPE ? type.name.value : namedType(type.type);

/** The named type of an operation's `$input`, e.g. `CreatePantryItemInput`. */
export const inputTypeOf = (document: DocumentNode): string | null => {
  for (const definition of document.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) continue;
    const input = definition.variableDefinitions?.find(
      v => v.variable.name.value === 'input',
    );
    if (input) return namedType(input.type);
  }
  return null;
};

/**
 * A write queued by a build that sent `expiresAt` as the picked day's local
 * midnight through `toISOString()`. The API stores that as its UTC date, a day
 * early east of UTC; read back on this device, the instant is the day the user
 * picked, so it replays as `expiresOn`.
 */
export const withExpiresOn = (
  document: DocumentNode,
  variables: OperationVariables,
): OperationVariables => {
  const input: unknown = variables.input;
  if (
    !isRecord(input) ||
    !('expiresAt' in input) ||
    'expiresOn' in input ||
    !DATE_ONLY_EXPIRY_INPUTS.has(inputTypeOf(document) ?? '')
  ) {
    return variables;
  }
  const { expiresAt, ...rest } = input;
  if (expiresAt === null) {
    return { ...variables, input: { ...rest, expiresOn: null } };
  }
  const instant = typeof expiresAt === 'string' ? new Date(expiresAt) : null;
  if (!instant || Number.isNaN(instant.getTime())) return variables;
  return { ...variables, input: { ...rest, expiresOn: toDateKey(instant) } };
};

type CalendarDayInput =
  | 'CreateMealPlanInput'
  | 'UpdateMealPlanInput'
  | 'CreateMealPlanItemInput'
  | 'UpdateMealPlanItemInput';

/** The inputs whose days became `LocalDate`, with the fields that hold one. */
const CALENDAR_DAY_FIELDS: Record<CalendarDayInput, readonly string[]> = {
  CreateMealPlanInput: ['startDate', 'endDate'],
  UpdateMealPlanInput: ['startDate', 'endDate'],
  CreateMealPlanItemInput: ['date'],
  UpdateMealPlanItemInput: ['date'],
};

/** An instant as the local day it falls on; a value that is not one, unchanged. */
const asDayKey = (value: unknown): unknown => {
  if (typeof value !== 'string' || !value.includes('T')) return value;
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? value : toDateKey(instant);
};

/**
 * A meal-plan write queued by a build that sent a day as local noon through
 * `toISOString()`. The API takes the calendar date and refuses a value with a
 * time; read back on this device, the instant is the day the user picked.
 */
export const withCalendarDays = (
  document: DocumentNode,
  variables: OperationVariables,
): OperationVariables => {
  const input: unknown = variables.input;
  const typeName = inputTypeOf(document) ?? '';
  if (!isRecord(input) || !isOwnKey(CALENDAR_DAY_FIELDS, typeName)) {
    return variables;
  }
  let next: Record<string, unknown> | null = null;
  for (const field of CALENDAR_DAY_FIELDS[typeName]) {
    const day = asDayKey(input[field]);
    if (day !== input[field]) next = { ...(next ?? input), [field]: day };
  }
  return next ? { ...variables, input: next } : variables;
};
