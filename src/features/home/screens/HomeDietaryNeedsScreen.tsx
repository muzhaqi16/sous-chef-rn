import React from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation, type TranslationKey } from '#/i18n';
import { RestrictionSeverity } from '#/graphql/generated/schemaTypes';
import { SubScreen } from '#components/templates/SubScreen';
import { RowCard } from '#components/atoms/RowCard';
import { Badge, type BadgeVariant } from '#components/atoms/Badge';
import { Text } from '#components/atoms/Text';
import { DataStateView } from '#components/organisms/DataStateView';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { useUser } from '#store/useAppStore';
import { getMemberDisplayName } from '#/utils/formatters/memberFormatters';
import {
  useHomeDietaryNeeds,
  type MemberDietaryNeeds,
} from '#features/home/hooks/useHomeDietaryNeeds';
import { homeTestIDs } from '#features/home/testIDs';

/** Strictest first: the order a cook reads them in. */
const SEVERITY_ORDER: readonly RestrictionSeverity[] = [
  RestrictionSeverity.Allergy,
  RestrictionSeverity.Intolerance,
  RestrictionSeverity.Preference,
  RestrictionSeverity.Goal,
];

const SEVERITY_LABEL_KEYS: Record<RestrictionSeverity, TranslationKey> = {
  [RestrictionSeverity.Allergy]: 'homeDietaryNeeds.severity.allergy',
  [RestrictionSeverity.Intolerance]: 'recipes.intolerances',
  [RestrictionSeverity.Preference]: 'homeDietaryNeeds.severity.preference',
  [RestrictionSeverity.Goal]: 'homeDietaryNeeds.severity.goal',
};

const SEVERITY_BADGE: Record<RestrictionSeverity, BadgeVariant> = {
  [RestrictionSeverity.Allergy]: 'danger',
  [RestrictionSeverity.Intolerance]: 'warning',
  [RestrictionSeverity.Preference]: 'default',
  [RestrictionSeverity.Goal]: 'primary',
};

type HomeDietaryNeedsScreenProps = StaticScreenProps<{ homeId: string }>;

/** What each member who shares with a home cannot or will not eat, by name. */
export const HomeDietaryNeedsScreen: React.FC<HomeDietaryNeedsScreenProps> = ({
  route,
}) => {
  const { homeId } = route.params;
  const { t } = useTranslation();
  const currentUser = useUser();
  const { members, state, retry } = useHomeDietaryNeeds(homeId);

  const nameOf = (member: MemberDietaryNeeds) =>
    member.userId === currentUser?.id
      ? t('homeDetail.youLabel')
      : getMemberDisplayName(
          {
            id: member.membershipId,
            role: member.role,
            displayName: member.displayName,
          },
          t,
          currentUser?.id,
        );

  return (
    <SubScreen
      title={t('homeDietaryNeeds.title')}
      testID={homeTestIDs.dietaryNeedsScreen}
    >
      <DataStateView
        state={state}
        onRetry={retry}
        empty={{
          icon: 'nutrition-outline',
          title: t('homeDietaryNeeds.emptyTitle'),
          description: t('homeDietaryNeeds.emptyBody'),
        }}
      />
      {state === 'ready' && (
        <View style={styles.list}>
          {members.map(member => (
            <RowCard
              key={member.membershipId}
              testID={homeTestIDs.dietaryNeedsMember(member.membershipId)}
            >
              <View style={[commonStyles.rowSurface, commonStyles.rowContent]}>
                <View style={styles.column}>
                  <Text role={rowType.title}>{nameOf(member)}</Text>
                  {SEVERITY_ORDER.map(severity => {
                    const held = member.restrictions.filter(
                      restriction => restriction.severity === severity,
                    );
                    if (held.length === 0) return null;
                    return (
                      <View key={severity} style={commonStyles.rowTextGap}>
                        <Text role={rowType.subtitle} tone="secondary">
                          {t(SEVERITY_LABEL_KEYS[severity])}
                        </Text>
                        <View style={styles.badges}>
                          {held.map(restriction => (
                            <Badge
                              key={restriction.id}
                              variant={SEVERITY_BADGE[severity]}
                            >
                              {restriction.label}
                            </Badge>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </RowCard>
          ))}
        </View>
      )}
    </SubScreen>
  );
};

const styles = StyleSheet.create(theme => ({
  list: {
    paddingTop: theme.spacing.md,
  },
  column: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
}));
