import { useSyncExternalStore } from 'react';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import {
  discardRefusedChange,
  namesNoRow,
  retryRefusedChange,
} from '#/apollo/offlineQueue/refusedChanges';
import type { QueuedMutation } from '#/apollo/offlineQueue/types';
import { isTranslationKey, useTranslation } from '#/i18n';
import { formatQuantity } from '#/utils/formatQuantity';
import { isRecord } from '#/utils/isRecord';

export type NotSavedReason = 'conflict' | 'gone' | 'refused';

export interface ChangeNotSaved {
  id: string;
  name: string;
  /** What the person entered, as far as it reads on its own. */
  entered: readonly string[];
  reason: NotSavedReason;
}

/** Row fields that are not the person's words: stamps, positions and enums. */
const NOT_ENTERED: ReadonlySet<string> = new Set([
  'updatedAt',
  'quantityInput',
  'sortOrder',
  'itemName',
  'category',
  'priority',
  'storageState',
  'condition',
  'tags',
  'expiresOn',
]);

const subscribe = (onStoreChange: () => void) =>
  queueStore.subscribe(onStoreChange);

const getSnapshot = () => queueStore.getRefused();

const stringIn = (source: unknown, field: string): string | undefined => {
  if (!isRecord(source)) return undefined;
  const value = source[field];
  return typeof value === 'string' && value !== '' ? value : undefined;
};

/** What the person calls the row, from the change or the row it changed. */
function nameOf({
  pendingWrite,
  variables,
}: QueuedMutation): string | undefined {
  const inputs = pendingWrite?.inputs;
  const named = [
    inputs?.fields,
    inputs?.row,
    inputs?.baseline,
    variables.input,
  ];
  for (const source of named) {
    const name = stringIn(source, 'itemName') ?? stringIn(source, 'name');
    if (name) return name;
  }
  return undefined;
}

function enteredIn(fields: unknown): string[] {
  if (!isRecord(fields)) return [];
  return Object.entries(fields).flatMap(([field, value]) => {
    if (NOT_ENTERED.has(field)) return [];
    if (typeof value === 'number') return [formatQuantity(value)];
    if (typeof value === 'string' && value !== '') return [value];
    const named = stringIn(value, 'name');
    return named ? [named] : [];
  });
}

function reasonOf({ lastError }: QueuedMutation): NotSavedReason {
  if (namesNoRow(lastError)) return 'gone';
  return lastError?.type === 'conflict' ? 'conflict' : 'refused';
}

/** The changes the server would not take, and what the person can do with them. */
export function useChangesNotSaved() {
  const { t } = useTranslation();
  const refused = useSyncExternalStore(subscribe, getSnapshot);

  const changes = refused.map((entry): ChangeNotSaved => {
    const resourceKey = `errors.resourceNames.${entry.refusedResource ?? ''}`;
    return {
      id: entry.id,
      name:
        nameOf(entry) ??
        (isTranslationKey(resourceKey)
          ? t(resourceKey)
          : t('changesNotSaved.aChange')),
      entered: enteredIn(entry.pendingWrite?.inputs.fields),
      reason: reasonOf(entry),
    };
  });

  return {
    changes,
    retry: retryRefusedChange,
    discard: discardRefusedChange,
  };
}
