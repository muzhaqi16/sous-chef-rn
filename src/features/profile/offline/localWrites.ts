/**
 * What each profile write changes on the device, as a pending layer. The
 * server's answer writes its own rows; `commit` adds what it cannot state.
 */
import type { OperationVariables } from '@apollo/client';
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  changeBrandEntries,
  dropBrandList,
  listBrandList,
  writeLocalBrandList,
  type LocalBrandEntry,
} from '#features/profile/cache/brandLists';
import {
  dropRestriction,
  hideRestriction,
  listRestriction,
  showLocalRestriction,
  type LocalRestriction,
} from '#features/profile/cache/restrictions';

/** The row a write names, from its variables. */
const subjectOf = ({ input }: OperationVariables): string | undefined => {
  const value: unknown = input;
  return isRecord(value) && typeof value.id === 'string' ? value.id : undefined;
};

export type AddRestrictionInputs = { row: LocalRestriction; now: string };

export const addRestriction: LocalWrite<AddRestrictionInputs> = {
  apply(cache, { inputs: { row, now } }) {
    showLocalRestriction(cache, row, now);
  },
  // The answer states the row, not the profile that lists it.
  commit(cache, _write, data) {
    const payload: unknown = appliedPayload(data);
    const id = isRecord(payload)
      ? subjectOf({ input: payload.dietaryRestriction })
      : undefined;
    if (id) listRestriction(cache, id);
  },
};

export type RemoveRestrictionInputs = { profileId?: string };

export const removeRestriction: LocalWrite<RemoveRestrictionInputs> = {
  apply(cache, { variables, inputs: { profileId } }) {
    const id = subjectOf(variables);
    if (id && profileId) hideRestriction(cache, profileId, id);
  },
  // The answer names the row, not the profile it left.
  commit(cache, { variables, inputs: { profileId } }) {
    const id = subjectOf(variables);
    if (id && profileId) dropRestriction(cache, profileId, id);
  },
};

export type CreateBrandListInputs = { name: string };

export const createBrandList: LocalWrite<CreateBrandListInputs> = {
  apply(cache, { variables, inputs: { name } }) {
    const id = subjectOf(variables);
    if (id) writeLocalBrandList(cache, id, name);
  },
  commit(cache, { variables }) {
    const id = subjectOf(variables);
    if (id) listBrandList(cache, id);
  },
};

const leaveBrandLists: LocalWrite['apply'] = (cache, { variables }) => {
  const id = subjectOf(variables);
  if (id) dropBrandList(cache, id);
};

export const removeBrandList: LocalWrite = {
  apply: leaveBrandLists,
  // The answer names the row, not the lists it left.
  commit: leaveBrandLists,
};

export type AddBrandInputs = { listId: string; entry: LocalBrandEntry };

export const addBrand: LocalWrite<AddBrandInputs> = {
  // The answer states the list, which settles the entry the server kept.
  apply(cache, { inputs: { listId, entry } }) {
    changeBrandEntries(cache, listId, entries =>
      entries.some(held => held.id === entry.id)
        ? entries
        : [...entries, entry],
    );
  },
};

export type RemoveBrandInputs = { listId: string };

const leaveBrandList: LocalWrite<RemoveBrandInputs>['apply'] = (
  cache,
  { variables, inputs: { listId } },
) => {
  const id = subjectOf(variables);
  if (!id) return;
  changeBrandEntries(cache, listId, entries =>
    entries.filter(entry => entry.id !== id),
  );
};

export const removeBrand: LocalWrite<RemoveBrandInputs> = {
  apply: leaveBrandList,
  // The answer names the entry, not the list it left.
  commit: leaveBrandList,
};
