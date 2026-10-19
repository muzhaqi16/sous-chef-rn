import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Text } from '#components/atoms/Text';
import { Button } from '#components/molecules/Button';
import { commonStyles } from '#/styles/commonStyles';
import { rowType } from '#/theme/foundations/type';
import { ROLE_PERMISSIONS } from '#features/shoppingList/constants/collaboratorRoles';
import {
  usePendingListInvites,
  type PendingListInvitesOptions,
} from '#features/shoppingList/hooks/usePendingListInvites';
import { shoppingListTestIDs } from '#features/shoppingList/testIDs';
import { SelectorSectionHeader } from './SelectorSectionHeader';

/** The list selector's invitations; nothing while none waits on the reader. */
export const PendingListInvites: React.FC<
  PendingListInvitesOptions
> = props => {
  const { t } = useTranslation();
  const { invites, answering, accept, decline } = usePendingListInvites(props);

  if (invites.length === 0) return null;

  return (
    <View testID={shoppingListTestIDs.pendingInvites}>
      <SelectorSectionHeader
        icon="mail-outline"
        title={t('labels.pendingInvitations')}
      />
      {invites.map(invite => {
        const role = t(ROLE_PERMISSIONS[invite.role].labelKey);
        const inFlight =
          answering?.inviteId === invite.id ? answering.answer : null;
        return (
          <View
            key={invite.id}
            style={commonStyles.rowWrapper}
            testID={shoppingListTestIDs.pendingInvite(invite.id)}
          >
            <View style={commonStyles.rowSurface}>
              <View style={commonStyles.rowContent}>
                <View style={styles.text}>
                  <Text role={rowType.title} numberOfLines={1}>
                    {invite.listName}
                  </Text>
                  <Text
                    role={rowType.subtitle}
                    tone="secondary"
                    numberOfLines={2}
                    style={commonStyles.rowTextGap}
                  >
                    {invite.inviterName
                      ? t('listInvites.invitedBy', {
                          name: invite.inviterName,
                          role,
                        })
                      : t('listInvites.invitedAnonymously', { role })}
                  </Text>
                </View>
                <Button
                  size="small"
                  variant="outline"
                  onPress={() => decline(invite)}
                  loading={inFlight === 'decline'}
                  disabled={!!answering}
                  testID={shoppingListTestIDs.pendingInviteDecline(invite.id)}
                >
                  {t('labels.decline')}
                </Button>
                <Button
                  size="small"
                  onPress={() => accept(invite)}
                  loading={inFlight === 'accept'}
                  disabled={!!answering}
                  testID={shoppingListTestIDs.pendingInviteAccept(invite.id)}
                >
                  {t('labels.accept')}
                </Button>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  text: {
    flex: 1,
  },
});
