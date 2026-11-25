import { getOperationAST, type DocumentNode } from 'graphql';
import { inputTypeNameOf } from '#apollo/utils/documentOperation';
import { LOCAL_WRITES } from '#apollo/pendingWrites/localWriteRegistry';
import type { WriteSubject } from '#apollo/pendingWrites/types';
import type { QueuedMutation, RowAdoption } from './types';
import { isRecord } from '#utils/isRecord';

export interface QueuedSubject {
  /** What the write creates or changes: its withdrawal target and pending ids. */
  subjectIds: string[];
  /** What the write is derived from: a dependency, never a target. */
  sourceIds: string[];
  /** The subset of `subjectIds` minted on the device, which the server has never seen. */
  mintedIds: string[];
}

/**
 * What a write's descriptor states of its subject. Unstated, the input's name
 * says: its `id`, minted by a `Create*Input`, deleted by a `Delete*Input`.
 */
const subjectOf = (mutation: DocumentNode): WriteSubject => {
  // Never throws, as `operationNameOf` does: an unnamed document has none.
  const name = getOperationAST(mutation)?.name?.value;
  return (name === undefined ? undefined : LOCAL_WRITES[name]?.subject) ?? {};
};

const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** Whether a queued write deletes the entity its subject names. */
export const deletesItsSubject = ({
  mutation,
}: {
  mutation: DocumentNode;
}): boolean =>
  subjectOf(mutation).deletes === true ||
  (inputTypeNameOf(mutation)?.startsWith('Delete') ?? false);

/** The API's name for a write of one entity: `Create|Update|Delete<Type>Input`. */
const ENTITY_WRITE_INPUT = /^(?:Create|Update|Delete)([A-Z][A-Za-z]*)Input$/;

/**
 * The type of the entity a write's `id` names, read off its input type: what to
 * call the write when the cache does not hold the row. Null for an input whose
 * subject is another field, or whose name states no type.
 */
export function subjectTypeOf({
  mutation,
}: {
  mutation: DocumentNode;
}): string | null {
  const typeName = inputTypeNameOf(mutation);
  if (!typeName || subjectOf(mutation).key !== undefined) return null;
  return ENTITY_WRITE_INPUT.exec(typeName)?.[1] ?? null;
}

/**
 * Reads a queued write's subject: the row its descriptor names, else its
 * `input.id`. `variables` is optional because an entry is read back from
 * persisted JSON.
 */
export function queuedSubject({
  mutation,
  variables,
}: {
  mutation: DocumentNode;
  variables?: QueuedMutation['variables'];
}): QueuedSubject {
  const fields: unknown = variables?.input;
  if (!isRecord(fields)) {
    return { subjectIds: [], sourceIds: [], mintedIds: [] };
  }

  const subject = subjectOf(mutation);
  const key = subject.key ?? 'id';
  const rowKey = subject.rowKey ?? 'id';
  const value = fields[key];

  const subjectIds = Array.isArray(value)
    ? value
        .map((row: unknown) => (isRecord(row) ? row[rowKey] : undefined))
        .filter(isId)
    : [value].filter(isId);
  const sourceIds = key !== 'id' && isId(fields.id) ? [fields.id] : [];
  const mints =
    subject.mints === true ||
    (key === 'id' &&
      (inputTypeNameOf(mutation)?.startsWith('Create') ?? false));

  return { subjectIds, sourceIds, mintedIds: mints ? subjectIds : [] };
}

/** What a later write waits on while this one is undelivered: its rows and its order. */
export function holdsBack(
  write: Pick<QueuedMutation, 'mutation' | 'variables' | 'orderedBy'>,
): string[] {
  const { subjectIds } = queuedSubject(write);
  return write.orderedBy ? [...subjectIds, write.orderedBy] : subjectIds;
}

/**
 * Input keys that name the PARENT a queued write attaches to. A deferred
 * parent holds these children back; the keys stay out of a write's
 * `subjectIds`, so a refused child never evicts its parent.
 */
export const PARENT_REFERENCE_KEYS: readonly string[] = [
  'homeId',
  'pantryId',
  'shoppingListId',
  'shoppingListItemId',
  'afterItemId',
  'beforeItemId',
  'storageLocationId',
  'parentLocationId',
  'mealPlanId',
  'mealPlanItemId',
  'templateId',
  'recipeIngredientId',
  'cookingLogId',
  'targetBatchId',
  'purchaseId',
  'recipeId',
  // A store a queued createStore may have minted.
  'storeId',
  'targetStoreId',
  'preferredStoreId',
  // A brand list a queued createBrandList may have minted.
  'brandListId',
];

/**
 * What a write waits on: the parents it attaches to at any depth (a batch
 * row, `meal.recipeId`, a purchase's `receipt.storeId`), and the entity it is
 * derived from (a fork's source recipe).
 */
export function dependencyIdsOf(write: {
  mutation: DocumentNode;
  variables?: QueuedMutation['variables'];
}): string[] {
  const ids = new Set<string>(queuedSubject(write).sourceIds);
  const collect = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (!isRecord(value)) return;
    for (const key of PARENT_REFERENCE_KEYS) {
      const id = value[key];
      if (typeof id === 'string' && id) ids.add(id);
    }
    Object.values(value).forEach(collect);
  };
  collect(write.variables?.input);
  return [...ids];
}

function replaceId(value: unknown, from: string, to: string): unknown {
  if (value === from) return to;
  if (Array.isArray(value)) {
    return value.map((element: unknown) => replaceId(element, from, to));
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => [
      key,
      replaceId(field, from, to),
    ]),
  );
}

/** Whether `value` names the id anywhere. */
export const mentionsId = (value: unknown, id: string): boolean =>
  value === id ||
  (Array.isArray(value)
    ? value.some((element: unknown) => mentionsId(element, id))
    : isRecord(value) &&
      Object.values(value).some(field => mentionsId(field, id)));

/** An input moved off a minted row, at the version the surviving row is at. */
export function inputOnSurvivingRow(
  input: Record<string, unknown>,
  { mintedId, survivingId, version }: RowAdoption,
): Record<string, unknown> {
  const moved = replaceId(input, mintedId, survivingId);
  if (!isRecord(moved)) return input;
  return version !== undefined && typeof moved.version === 'number'
    ? { ...moved, version }
    : moved;
}
