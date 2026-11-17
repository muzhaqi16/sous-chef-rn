import { useSyncExternalStore } from 'react';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { isRecord } from '#/utils/isRecord';
import { formatQuantityWithUnit } from '#/utils/formatQuantity';
import { useAppStore } from '#store/useAppStore';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { CreatePantryItemUsageDocument } from '#features/pantry/graphql/pantry.generated';

const USAGE = operationNameOf(CreatePantryItemUsageDocument);

const subscribe = (listener: () => void) => queueStore.subscribe(listener);

/**
 * The uses of stack `id` queued with no stock effect, as only the server can
 * convert their unit: one `amount unitId` per line. A string, so the row
 * re-renders only when it changes.
 */
const unconvertedUsesOf = (id: string): string =>
  queueStore
    .getPendingWrites()
    .flatMap(({ operationName, variables, inputs }) => {
      const input: unknown = variables.input;
      if (
        operationName !== USAGE ||
        !isRecord(input) ||
        input.pantryItemId !== id
      ) {
        return [];
      }
      const { delta, stated } = inputs;
      return delta === null &&
        isRecord(stated) &&
        typeof stated.amount === 'number' &&
        typeof stated.unitId === 'string'
        ? [`${stated.amount} ${stated.unitId}`]
        : [];
    })
    .join('\n');

/**
 * What a row's queued uses stated, "4 oz", where only the server can turn them
 * into its stock: shown as waiting, never as stock it moved. Read only while
 * the row has a write queued, so other rows never scan the queue.
 */
export function usePendingUses(
  id: string | undefined,
  queued: boolean,
): string | null {
  const key = useSyncExternalStore(subscribe, () =>
    id && queued ? unconvertedUsesOf(id) : '',
  );
  const cachedUnits = useAppStore(state => state.cachedUnits);
  if (!key) return null;
  const shown = key.split('\n').flatMap(entry => {
    const [amount, unitId] = entry.split(' ');
    const unit = cachedUnits.find(held => held.id === unitId);
    return unit ? [formatQuantityWithUnit(Number(amount), unit)] : [];
  });
  return shown.length > 0 ? shown.join(', ') : null;
}
