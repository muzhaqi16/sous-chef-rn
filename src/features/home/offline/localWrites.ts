/**
 * What each home write changes on the device, as a pending layer. The server's
 * answer writes its own rows; `commit` adds what it cannot state.
 */
import type { LocalWrite } from '#/apollo/pendingWrites/types';
import type { CreateHomeInput } from '#/graphql/generated/schemaTypes';
import {
  writeLocalHome,
  type HomeCreator,
} from '#features/home/cache/optimisticHome';
import { addToHomesCache } from '#features/home/hooks/homeCacheUpdaters';
import { applyDefaultHome } from '#features/home/utils/defaultHomeCacheWrites';

export type CreateHomeInputs = {
  home: CreateHomeInput & { id: string };
  /** Absent with no auth identity: nobody would own the home, so none is shown. */
  creator?: HomeCreator;
  now: string;
};

export const createHome: LocalWrite<CreateHomeInputs> = {
  apply(cache, { inputs: { home, creator, now } }) {
    if (creator) writeLocalHome(cache, home.id, home, creator, now);
  },
  // The answer states the home whole, with the server's membership in place of
  // the placeholder, which leaves with this layer.
  commit(cache, { inputs: { home } }) {
    addToHomesCache(
      cache,
      { __typename: 'Home', id: home.id },
      { position: 'end' },
    );
  },
};

export type MarkDefaultHomeInputs = { homeId: string };

const showDefaultHome: LocalWrite<MarkDefaultHomeInputs>['apply'] = (
  cache,
  { inputs: { homeId } },
) => {
  applyDefaultHome(cache, homeId);
};

export const markDefaultHome: LocalWrite<MarkDefaultHomeInputs> = {
  apply: showDefaultHome,
  // The payload never returns the flag.
  commit: showDefaultHome,
};
