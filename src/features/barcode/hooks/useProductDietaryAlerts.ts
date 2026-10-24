import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import type {
  DietaryAlertState,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { restrictionLabel } from '#domain/dietary';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useSelectedHomeId, useUser } from '#store/useAppStore';
import { getMemberDisplayName } from '#/utils/formatters/memberFormatters';
import { ProductDietaryAlertsDocument } from './useProductDietaryAlerts.generated';

/** One member restriction a product meets, worded to show. */
export interface ProductDietaryAlert {
  /** The restriction's id: one alert per restriction. */
  id: string;
  /** The member's name in the home; "You" for the user. */
  memberName: string;
  /** What the restriction restricts, as the user's language words it. */
  what: string;
  state: DietaryAlertState;
  severity: RestrictionSeverity;
  /** A diet reads "not vegan", where the others read "contains peanuts". */
  isDiet: boolean;
}

/** A product of the same kind that meets no member's restriction. */
export interface DietaryAlternative {
  id: string;
  name: string;
  imageUrl: string | null;
  primaryUpc: string | null;
}

/**
 * - `checked`: the server answered just now.
 * - `stale`: offline, showing the answer received earlier.
 * - `unchecked`: offline with no earlier answer; never shown as "nothing found".
 * - `loading`: the first answer is on its way.
 * - `none`: no home to check against.
 */
export type HouseholdCheck =
  | 'checked'
  | 'stale'
  | 'unchecked'
  | 'loading'
  | 'none';

/**
 * The household's alerts for one product, read through the persisted cache so
 * a product checked before still shows them offline.
 */
export function useProductDietaryAlerts(itemId: string) {
  const { t } = useTranslation();
  const homeId = useSelectedHomeId();
  const currentUserId = useUser()?.id;
  const offline = useIsApiUnavailable();
  const { data, loading, error } = useQuery(
    ProductDietaryAlertsDocument,
    homeId ? { variables: { itemId, homeId } } : skipToken,
  );

  const item = data?.item;
  const alerts: ProductDietaryAlert[] = (item?.dietaryAlerts ?? []).map(
    ({ state, membership, restriction }) => ({
      id: restriction.id,
      memberName: getMemberDisplayName(
        {
          id: membership.id,
          role: membership.role,
          displayName: membership.displayName,
          user: { id: membership.userId },
        },
        t,
        currentUserId,
      ),
      what: restrictionLabel(restriction, t),
      state,
      severity: restriction.severity,
      isDiet: !!restriction.diet,
    }),
  );
  const alternatives: DietaryAlternative[] = (
    item?.dietaryAlternatives ?? []
  ).map(({ id, name, imageUrl, primaryUpc }) => ({
    id,
    name,
    imageUrl,
    primaryUpc,
  }));

  const check: HouseholdCheck = !homeId
    ? 'none'
    : item
    ? offline
      ? 'stale'
      : 'checked'
    : offline || error
    ? 'unchecked'
    : loading
    ? 'loading'
    : 'unchecked';

  return { check, alerts, alternatives };
}
