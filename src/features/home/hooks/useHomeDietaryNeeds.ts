import { useQuery } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import type {
  MembershipRole,
  RestrictionSeverity,
} from '#/graphql/generated/schemaTypes';
import { restrictionLabel } from '#domain/dietary';
import { useDataState } from '#hooks/data/useDataState';
import { HomeDietaryNeedsDocument } from './useHomeDietaryNeeds.generated';

/** One member who shares with the home, and what the home sees of them. */
export interface MemberDietaryNeeds {
  membershipId: string;
  userId: string;
  role: MembershipRole;
  displayName: string | null;
  /** Strictest first, as the server orders them; each worded to show. */
  restrictions: {
    id: string;
    label: string;
    severity: RestrictionSeverity;
  }[];
}

/**
 * What a home's members cannot or will not eat, read live from each sharing
 * member. Cache and network: it opens offline from the last visit and is fresh
 * on every visit, so a member who left or stopped sharing is gone.
 */
export function useHomeDietaryNeeds(homeId: string) {
  const { t } = useTranslation();
  const { data, loading, error, refetch } = useQuery(HomeDietaryNeedsDocument, {
    variables: { homeId },
  });

  const members: MemberDietaryNeeds[] = (data?.home?.dietaryNeeds ?? []).map(
    ({ membership, restrictions }) => ({
      membershipId: membership.id,
      userId: membership.userId,
      role: membership.role,
      displayName: membership.displayName,
      restrictions: restrictions.map(restriction => ({
        id: restriction.id,
        label: restrictionLabel(restriction, t),
        severity: restriction.severity,
      })),
    }),
  );

  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: members.length === 0,
  });

  return {
    members,
    state,
    retry: () => {
      void refetch();
    },
  };
}
