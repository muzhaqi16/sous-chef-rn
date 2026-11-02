import React from 'react';
import { View } from 'react-native';
import type { StaticScreenProps } from '@react-navigation/native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { SubScreen } from '#components/templates/SubScreen';
import { RowCard } from '#components/atoms/RowCard';
import { ListItem } from '#components/molecules/ListItem';
import { DataStateView } from '#components/organisms/DataStateView';
import { useUser } from '#store/useAppStore';
import { getMemberDisplayName } from '#/utils/formatters/memberFormatters';
import {
  useHomeDietaryNeeds,
  type MemberDietaryNeeds,
} from '#features/home/hooks/useHomeDietaryNeeds';
import { DietaryNeedsSummary } from '#features/home/components/DietaryNeedsSummary';
import { homeTestIDs } from '#features/home/testIDs';

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
    getMemberDisplayName(
      {
        id: member.membershipId,
        role: member.role,
        displayName: member.displayName,
        user: { id: member.userId },
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
              <ListItem
                title={nameOf(member)}
                titleNumberOfLines={1}
                subtitle={<DietaryNeedsSummary groups={member.groups} />}
              />
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
}));
