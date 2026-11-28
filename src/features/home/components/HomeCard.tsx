import React from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { View } from 'react-native';
import { useTranslation } from '#i18n';
import { StyleSheet } from 'react-native-unistyles';
import { useFragment } from '@apollo/client/react';
import { useIncompleteCellReport } from '#hooks/apollo/useIncompleteCellReport';

import { MembersList } from './MembersList';
import { RowCard } from '#components/atoms/RowCard';
import { ListItem } from '#components/molecules/ListItem';
import { homeTestIDs } from '#features/home/testIDs';
import { HomeCard_HomeFragmentDoc } from './HomeCard.generated';

interface HomeCardProps {
  homeId: string;
  isDefault: boolean;
  /** The home this device is on; a default it is not on offers the switch back. */
  isCurrent: boolean;
  isHighlighted?: boolean;
  canInvite: boolean;
  onPress?: (homeId: string) => void;
  onSetDefault: (homeId: string) => void;
  onInvite: (homeId: string) => void;
}

export const HomeCard: React.FC<HomeCardProps> = ({
  homeId,
  isDefault,
  isCurrent,
  isHighlighted = false,
  canInvite,
  onPress,
  onSetDefault,
  onInvite,
}) => {
  const { t } = useTranslation();
  // Per-entity cache subscription: this card re-renders only when this Home's
  // fields change. `GetHomes` fetches them through `home_listed`.
  const {
    data: home,
    complete,
    missing,
  } = useFragment({
    fragment: HomeCard_HomeFragmentDoc,
    fragmentName: 'HomeCard_home',
    from: { __typename: 'Home', id: homeId },
  });
  useIncompleteCellReport('HomeCard_home', missing);

  if (!complete) return null;

  const memberCount = home.membersConnection.totalCount;
  const pantryCount = home.pantriesConnection.totalCount;
  const members = home.membersConnection.edges.map(e => e.node);
  const invites = home.invitesConnection.edges.map(e => e.node);

  const isDefaultHere = isDefault && isCurrent;
  const counts = `${t('labels.memberCount', { count: memberCount })} • ${t(
    'joinHome.pantryCount',
    { count: pantryCount },
  )}`;

  return (
    <RowCard highlighted={isHighlighted}>
      <ListItem
        title={home.name}
        subtitle={counts}
        onPress={onPress ? () => onPress(home.id) : undefined}
        accessibilityLabel={`${home.name}, ${t('labels.memberCount', {
          count: memberCount,
        })}, ${t('joinHome.pantryCount', {
          count: pantryCount,
        })}${isDefault ? t('homeManagement.accessibilityDefaultSuffix') : ''}`}
        accessibilityHint={t('homeManagement.accessibilityHint')}
        badge={
          isDefaultHere
            ? { text: t('homeManagement.cardDefault'), variant: 'primary' }
            : undefined
        }
        trailingActions={
          isDefaultHere ? undefined : (
            <IconButton
              name="star-outline"
              size="md"
              tone="textSecondary"
              onPress={() => onSetDefault(home.id)}
              accessibilityLabel={t('labels.setDefault')}
              accessibilityRole="button"
              testID={homeTestIDs.setDefaultButton(home.id)}
            />
          )
        }
      />
      <View style={styles.members}>
        <MembersList
          members={members}
          invites={invites}
          onInvite={canInvite ? () => onInvite(home.id) : undefined}
        />
      </View>
    </RowCard>
  );
};

const styles = StyleSheet.create(theme => ({
  members: {
    paddingHorizontal: theme.layout.rowInsetHorizontal,
    paddingBottom: theme.layout.rowInset,
  },
}));
