/**
 * useUpdatePantryItem — non-quantity field edits for a pantry item
 * (local-first).
 *
 * Single responsibility:
 * - Update non-quantity fields (storage, notes, tags, brand, etc.)
 * - Only sends changed fields (dirty field tracking)
 * - Version conflict handling
 *
 * The edit is described once as a `WriteIntent`; the kit applies it to the
 * cache permanently, derives the patch that undoes it, and carries it to the
 * offline queue. A queued edit stays visible and replays via the idempotent
 * `SyncPantryItem` upsert; a refusal is undone from the intent — synchronously
 * here, and from the persisted intent when a queued replay is refused later.
 *
 * Fire-and-forget by design: the form navigates away the moment `onSuccess`
 * runs, so the mutation is not awaited.
 */

import { gql } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { errorService } from '#/services/errorService';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { useWrite } from '#/apollo/write/useWrite';
import { refToCacheId, type FieldPatch } from '#/apollo/write/writeIntent';
import { generateEntityId } from '#/utils/generateEntityId';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { t } from '#/i18n';
import { buildDirtyUpdateInput } from './utils';
import type { FormDataInput, UnitSelection } from './types';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { logger } from '#/utils/environment';

interface UseUpdatePantryItemOptions {
  onSuccess?: () => void;
  refetch?: () => void;
}

interface UpdatePantryItemFieldsParams {
  itemId: string;
  input: FormDataInput;
  dirtyFields: Record<string, boolean>;
  selectedLocationId: string | null;
  selectedBrandId: string | null;
  trackingUnit?: UnitSelection;
  selectedStorageLocation?: { id: string; name: string; type: string } | null;
  unitSymbol?: string;
}

/**
 * `UpdatePantryItemInput.version` is required, so the write has to carry one,
 * and the unit patch only fires when the tracking unit actually changes.
 * Everything else the hook used to snapshot is now the kit's business.
 *
 * It is necessarily the version as of the save — nothing can refresh it before
 * a queued replay — so a stale one is expected offline. The queue's conflict
 * path refreshes it and re-sends, which is what `convergence: 'absolute'`
 * selects.
 */
const ITEM_STATE = gql`
  fragment UpdatePantryItemState on PantryItem {
    version
    unit {
      id
    }
  }
`;

export function useUpdatePantryItem({
  onSuccess,
  refetch,
}: UseUpdatePantryItemOptions) {
  const client = useApolloClient();
  const { apply } = useWrite();

  // No `onError`: under the global `errorPolicy: 'all'` a failing mutation
  // RESOLVES, and `onError` fires on that resolved error too — handling it
  // there as well as on the result would report it twice. The result branch
  // below owns it, because that is also where the write has to be undone.
  const [updateMutation] = useMutation(UpdatePantryItemDocument);

  /**
   * Update non-quantity fields of a pantry item
   * Fires mutation asynchronously - doesn't await to allow immediate navigation
   */
  const updatePantryItemFields = ({
    itemId,
    input,
    dirtyFields,
    selectedLocationId,
    selectedBrandId,
    trackingUnit,
    selectedStorageLocation,
    unitSymbol,
  }: UpdatePantryItemFieldsParams): void => {
    // Build input for dirty fields only
    const updateInput = buildDirtyUpdateInput(
      input,
      dirtyFields,
      selectedLocationId,
      selectedBrandId,
      unitSymbol,
    );

    // Only fire mutation if there are changes
    if (Object.keys(updateInput).length === 0) {
      onSuccess?.();
      return;
    }

    const state = client.cache.readFragment<{
      version?: number;
      unit?: { id: string } | null;
    }>({
      id: refToCacheId({ __typename: 'PantryItem', id: itemId }),
      fragment: ITEM_STATE,
      // A row cached without one of these still identifies an item that exists;
      // only a genuinely absent entity should stop the edit.
      returnPartialData: true,
    });

    if (!state) {
      logger.warn('Item not found, cannot update:', itemId);
      return;
    }

    // The patch is PantryItem-shaped, not mutation-input-shaped: it says what
    // the person will see change, which is a different vocabulary from what the
    // server is told (`storage.storageNotes` there, `storageNotes` here).
    const patch: FieldPatch = { updatedAt: new Date().toISOString() };
    if (dirtyFields.itemName) patch.itemName = input.itemName;
    if (dirtyFields.storageState) patch.storageState = input.storageState;
    if (dirtyFields.condition && input.condition) {
      patch.condition = input.condition;
    }
    if (dirtyFields.expirationDate) {
      patch.expiresAt = input.expirationDate?.toISOString() ?? null;
    }
    if (dirtyFields.tags) patch.tags = input.tags || [];
    if (dirtyFields.minQuantity) {
      patch.minQuantity = input.minQuantity
        ? parseDecimalInput(input.minQuantity)
        : null;
    }
    if (dirtyFields.restockQuantity) {
      patch.restockQuantity = input.restockQuantity
        ? parseDecimalInput(input.restockQuantity)
        : null;
    }
    if (dirtyFields.netWeight) {
      patch.netWeight = input.netWeight
        ? parseDecimalInput(input.netWeight)
        : null;
    }
    if (dirtyFields.notes) patch.storageNotes = input.notes;
    // A normalized field takes a REFERENCE, never an object literal: the kit
    // shallow-merges object values, and merging fields onto an existing
    // `{ __ref }` leaves the ref in place — the read follows it and the change
    // is silently lost. The location was picked out of the cache, so the entity
    // it points at is already there with the fields the item's query selects.
    if (dirtyFields.location && selectedStorageLocation) {
      patch.storageLocation = {
        __ref: refToCacheId({
          __typename: 'StorageLocation',
          id: selectedStorageLocation.id,
        }),
      };
    }
    // Clearing a brand is the only brand change expressible locally — setting
    // one sends a name or an id the server resolves, so there is nothing to
    // point at yet.
    if (dirtyFields.brand && !selectedBrandId && !input.brand?.trim()) {
      patch.brand = null;
    }
    // Point at the new unit so a concurrent `updateQuantity` response cannot
    // leave the old one on screen. Reaching here means a unit id was resolved,
    // which means `updateQuantity` has already written that Unit in full.
    if (trackingUnit?.id && trackingUnit.id !== state.unit?.id) {
      patch.unit = {
        __ref: refToCacheId({ __typename: 'Unit', id: trackingUnit.id }),
      };
    }

    const { context, revert } = apply({
      target: { __typename: 'PantryItem', id: itemId },
      patch,
      // The values are final ones the person typed as facts, so a version
      // conflict is resolved by refreshing the version and re-sending rather
      // than by discarding what they entered. See `WriteConvergence`.
      convergence: 'absolute',
    });

    updateMutation({
      variables: {
        input: {
          ...updateInput,
          id: itemId,
          // Required by the input; a row cached without it is the
          // partial-read case, and 0 loses the concurrency check rather than
          // failing the send.
          version: state.version ?? 0,
          // Claimed by the server BEFORE its version check, so a queued replay
          // converges instead of being refused on the stale version it
          // necessarily carries.
          idempotencyKey: generateEntityId(),
        },
      },
      context,
    })
      .then(result => {
        // 'queued' (null payload, no error) keeps the write — the change
        // replays later, and the queue undoes it from the persisted intent if
        // that replay is refused.
        //
        // A refused union payload (`ValidationError`, a version conflict)
        // resolves as DATA, so nothing else will surface it — without the alert
        // below the edit just snaps back unexplained. One such refusal is
        // reachable from the edit form: since 2026-08-22 the server resolves a
        // bare `unit.unitSymbol` to a real unit and refuses the change while
        // the item still has batches, or when no conversion exists
        // (docs/api/breaking-changes.md). Those arrive as a ValidationError
        // with `field: "unit"`, which routes to localized `errors.field.unit`
        // copy — the generic copy is only for an unattributed refusal. The
        // server's `message` is English and unused.
        // `result.error` is tested FIRST, and the order is load-bearing:
        // `classifyCreateResult` returns 'rejected' for a transport error too,
        // and `alertRejectedMutation` deliberately no-ops when `result.error`
        // is set — so classifying first made this branch unreachable, and an
        // ordinary network failure reverted the edit and said NOTHING, with
        // the version-conflict Refresh prompt never offered either. This hook
        // keeps no `useMutation` onError, so this is the only report there is.
        if (result.error) {
          revert();
          handleMutationError(result.error, {
            operation: 'Update Pantry Item',
            checks: [versionConflictCheck({ onRefresh: refetch })],
          });
          return;
        }
        if (classifyCreateResult(result) === 'rejected') {
          // Refused on the spot, so it never entered the queue and the queue's
          // withdrawal will never see it.
          revert();
          alertRejectedMutation(result, t('errors.updateItemFailed'));
        }
      })
      .catch(error => {
        revert();
        errorService.reportError(error, { operation: 'updatePantryItem' });
      });

    onSuccess?.();
  };

  return { updatePantryItemFields };
}
