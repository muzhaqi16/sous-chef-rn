import React, { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { useFragment } from '@apollo/client/react';
import type { FragmentType } from '@apollo/client/masking';
import { Icon } from '#components/atoms/Icon';
import { RowCard } from '#components/atoms/RowCard';
import type { BadgeContent } from '#components/atoms/Badge';
import { ListItem } from '#components/molecules/ListItem';
import { formatRole } from '#/utils/formatters/roleFormatters';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';
import type { MembershipPermissionKey } from '#features/home/types';
import {
  canGrantFlag,
  canManageMember,
  getAssignableRoles,
  type HomeViewer,
} from '#features/home/utils/homePermissions';
import { HomeMemberCard_MemberFragmentDoc } from './HomeMemberCard.generated';
import { MemberSettingsSheet } from './MemberSettingsSheet';
import { MembershipRole } from '#/graphql/generated/schemaTypes';

const CHEVRON_SIZE = 20;

interface HomeMemberCardProps {
  memberRef: FragmentType<typeof HomeMemberCard_MemberFragmentDoc>;
  displayName: string;
  isCurrentUser: boolean;
  /** The current user's own membership: decides which actions render. */
  viewer: HomeViewer | null;
  /** Another row shows a chevron: hold its slot so the badges line up. */
  reserveChevron?: boolean;
  onChangeRole: (role: MembershipRole) => void;
  onRemove: () => void;
  onTransferOwnership?: () => void;
  transferDisabled?: boolean;
  onUpdatePermission?: (
    permission: MembershipPermissionKey,
    value: boolean,
  ) => void;
}

/**
 * One row per member; a member the viewer may manage opens its settings sheet.
 * Reads its Membership through `useFragment`, so it re-renders alone when this
 * member changes.
 */
export const HomeMemberCard: React.FC<HomeMemberCardProps> = ({
  memberRef,
  displayName,
  isCurrentUser,
  viewer,
  reserveChevron = false,
  onChangeRole,
  onRemove,
  onTransferOwnership,
  transferDisabled,
  onUpdatePermission,
}) => {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { data: member, complete } = useFragment({
    fragment: HomeMemberCard_MemberFragmentDoc,
    fragmentName: 'HomeMemberCard_member',
    from: memberRef,
  });

  if (!complete) return null;

  const roleLabel = formatRole(member.role, t);
  const badge: BadgeContent = { text: roleLabel, variant: 'primary' };

  if (!viewer || !canManageMember(viewer, member.role, isCurrentUser)) {
    return (
      <RowCard>
        <ListItem
          title={displayName}
          titleNumberOfLines={1}
          badge={badge}
          accessibilityLabel={accessibilityLabelOf(displayName, roleLabel)}
          rightElement={
            reserveChevron ? <View style={styles.chevronSlot} /> : undefined
          }
        />
      </RowCard>
    );
  }

  return (
    <>
      <RowCard>
        <ListItem
          title={displayName}
          titleNumberOfLines={1}
          badge={badge}
          onPress={() => setSettingsOpen(true)}
          rightElement={
            <Icon
              name="chevron-forward"
              size={CHEVRON_SIZE}
              tone="textSecondary"
            />
          }
        />
      </RowCard>
      <MemberSettingsSheet
        visible={settingsOpen}
        onDismiss={() => setSettingsOpen(false)}
        name={displayName}
        email={member.user.email}
        role={member.role}
        roles={getAssignableRoles(viewer.role)}
        onChangeRole={onChangeRole}
        permissions={member}
        canGrant={permission => canGrantFlag(viewer, permission)}
        onUpdatePermission={onUpdatePermission}
        onTransferOwnership={
          viewer.role === MembershipRole.Owner ? onTransferOwnership : undefined
        }
        transferDisabled={transferDisabled}
        onRemove={onRemove}
      />
    </>
  );
};

const styles = StyleSheet.create({
  chevronSlot: {
    width: CHEVRON_SIZE,
  },
});
