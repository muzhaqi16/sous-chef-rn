import { skipToken, useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  householdCheckOf,
  toHouseholdAlert,
  type HouseholdAlert,
  type HouseholdCheck,
} from '#domain/dietary';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useSelectedHomeId, useUser } from '#store/useAppStore';
import { ProductDietaryAlertsDocument } from './useProductDietaryAlerts.generated';

/** A product of the same kind that meets no member's restriction. */
export interface DietaryAlternative {
  id: string;
  name: string;
  imageUrl: string | null;
  primaryUpc: string | null;
}

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
  const alerts: HouseholdAlert[] = (item?.dietaryAlerts ?? []).map(alert =>
    toHouseholdAlert(alert, t, currentUserId),
  );
  const alternatives: DietaryAlternative[] = (
    item?.dietaryAlternatives ?? []
  ).map(({ id, name, imageUrl, primaryUpc }) => ({
    id,
    name,
    imageUrl,
    primaryUpc,
  }));

  const check: HouseholdCheck = householdCheckOf({
    hasHome: !!homeId,
    answered: !!item,
    offline,
    failed: !!error,
    loading,
  });

  return { check, alerts, alternatives };
}
