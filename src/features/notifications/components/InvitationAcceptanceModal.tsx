import React, { useState } from 'react';
import { View, Modal, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { WhiteActivityIndicator } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import { Icon } from '#utils/iconUtils';
import { toastService } from '#/services/toastService';
import { t as tGlobal } from '#/i18n/t';
import {
  AcceptHomeInviteDocument,
  DeclineHomeInviteDocument,
  GetHomesDocument,
  GetMyPendingInvitesDocument,
} from '#operations/home/home.generated';
import {
  AcceptShoppingListInviteDocument,
  DeclineShoppingListInviteDocument,
  MyShoppingListInvitesDocument,
  type MyShoppingListInvitesQuery,
} from './InvitationAcceptanceModal.generated';
import { createAddToQueryFieldUpdater } from '#/apollo/utils/cacheUpdaters';
import { executeAsyncWithCleanup } from '#/utils/compilerSafeWrappers';
import { Text } from '#components/atoms/Text';

const ErrorActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.error,
}));

/** Module-level cache updater to keep try-catch out of the component body (React Compiler). */
function updateShoppingListCache(cache: ApolloCache, collaborator: any): void {
  try {
    const addToShoppingListsCache =
      createAddToQueryFieldUpdater('shoppingLists');
    addToShoppingListsCache(cache, collaborator, { position: 'end' });
  } catch (error) {
    console.warn('Cache update failed for acceptShoppingListInvite:', error);
  }
}

const getInvitationErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  const msg = (error as Error)?.message?.toLowerCase() || '';
  return msg.includes('expired') || msg.includes('invalid')
    ? tGlobal('errors.invitationExpired')
    : (error as Error)?.message || fallback;
};

export interface InvitationData {
  type: 'HOME_INVITE' | 'SHOPPING_LIST_INVITE';
  id: string;
  title: string;
  description: string;
  inviterName?: string;
  entityName: string; // Home name or Shopping List name
  token?: string;
  payload: any;
}

interface InvitationAcceptanceModalProps {
  visible: boolean;
  invitation: InvitationData | null;
  onClose: () => void;
  onAccept?: (invitation: InvitationData) => void;
  onReject?: (invitation: InvitationData) => void;
  onInvalidate?: (invitation: InvitationData) => void;
}

export const InvitationAcceptanceModal: React.FC<
  InvitationAcceptanceModalProps
> = ({ visible, invitation, onClose, onAccept, onReject, onInvalidate }) => {
  const { t } = useTranslation();
  const invitationUnavailableMsg = t('errors.invitationUnavailable');
  const client = useApolloClient();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const [acceptHomeInvite] = useMutation(AcceptHomeInviteDocument, {
    refetchQueries: [
      { query: GetHomesDocument },
      { query: GetMyPendingInvitesDocument },
    ],
    awaitRefetchQueries: true,
  });
  const [acceptShoppingListInvite] = useMutation(
    AcceptShoppingListInviteDocument,
    {
      refetchQueries: [{ query: MyShoppingListInvitesDocument }],
      update: (cache, { data }) => {
        if (!data?.acceptShoppingListInvite?.collaborator) return;
        updateShoppingListCache(
          cache,
          data.acceptShoppingListInvite.collaborator,
        );
      },
    },
  );
  const [declineHomeInvite] = useMutation(DeclineHomeInviteDocument, {
    refetchQueries: [{ query: GetMyPendingInvitesDocument }],
  });
  const [declineShoppingListInvite] = useMutation(
    DeclineShoppingListInviteDocument,
    {
      refetchQueries: [{ query: MyShoppingListInvitesDocument }],
    },
  );

  const resolveToken = async (): Promise<string | undefined> => {
    let token = invitation?.token;
    if (!token && invitation?.type === 'SHOPPING_LIST_INVITE') {
      const result = await client.query<MyShoppingListInvitesQuery>({
        query: MyShoppingListInvitesDocument,
        fetchPolicy: 'network-only',
      });
      const invites = result.data?.me?.pendingCollaborationInvites;
      const invite = invites?.find(
        inv => inv.id === invitation.payload?.inviteId,
      );
      token = invite?.token ?? undefined;
    }
    return token;
  };

  const handleAccept = () => {
    if (!invitation) return;

    setAccepting(true);
    executeAsyncWithCleanup(
      async () => {
        const token = await resolveToken();

        if (!token) {
          onInvalidate?.(invitation);
          onClose();
          toastService.error(invitationUnavailableMsg);
          setAccepting(false);
          return;
        }

        if (invitation.type === 'HOME_INVITE') {
          const result = await acceptHomeInvite({
            variables: { token: token! },
          });

          if (result.error) {
            onClose();
            toastService.error(
              getInvitationErrorMessage(
                result.error,
                t('invitationAcceptance.acceptFailed'),
              ),
            );
            return;
          }

          if (result.data?.acceptHomeInvite?.membership) {
            const newHomeId = result.data.acceptHomeInvite.membership.homeId;

            // Pass the homeId to the handler so it can update the store
            const invitationWithHomeId = {
              ...invitation,
              acceptedHomeId: newHomeId,
            };

            onAccept?.(invitationWithHomeId);
            onClose();
          } else if (result.data?.acceptHomeInvite?.success) {
            // Already accepted — token was valid but no new membership created
            onAccept?.(invitation);
            onClose();
          }
        } else if (invitation.type === 'SHOPPING_LIST_INVITE') {
          const result = await acceptShoppingListInvite({
            variables: { token: token! },
          });

          if (result.error) {
            onClose();
            toastService.error(
              getInvitationErrorMessage(
                result.error,
                t('invitationAcceptance.acceptFailed'),
              ),
            );
            return;
          }

          if (result.data?.acceptShoppingListInvite?.success) {
            onAccept?.(invitation);
            onClose();
          }
        }
      },
      () => setAccepting(false),
      (error: unknown) => {
        onClose();
        toastService.error(
          getInvitationErrorMessage(
            error,
            t('invitationAcceptance.acceptFailed'),
          ),
        );
      },
    );
  };

  const handleReject = async () => {
    if (!invitation) return;

    // Show confirmation alert
    alertService.alert(
      t('confirmations.declineInvitationTitle'),
      t('confirmations.declineInvitation', {
        entityName: invitation.entityName,
      }),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.decline'),
          style: 'destructive',
          onPress: () => {
            setRejecting(true);
            executeAsyncWithCleanup(
              async () => {
                const token = await resolveToken();

                if (!token) {
                  onInvalidate?.(invitation);
                  onClose();
                  toastService.error(invitationUnavailableMsg);
                  setRejecting(false);
                  return;
                }

                if (invitation.type === 'HOME_INVITE') {
                  const result = await declineHomeInvite({
                    variables: { token: token! },
                  });

                  if (result.error) {
                    onClose();
                    toastService.error(
                      getInvitationErrorMessage(
                        result.error,
                        t('invitationAcceptance.declineFailed'),
                      ),
                    );
                    return;
                  }
                } else if (invitation.type === 'SHOPPING_LIST_INVITE') {
                  const result = await declineShoppingListInvite({
                    variables: { token: token! },
                  });

                  if (result.error) {
                    onClose();
                    toastService.error(
                      getInvitationErrorMessage(
                        result.error,
                        t('invitationAcceptance.declineFailed'),
                      ),
                    );
                    return;
                  }
                }

                toastService.success(
                  t('success.invitationDeclinedTo', {
                    entityName: invitation.entityName,
                  }),
                );
                onReject?.(invitation);
                onClose();
              },
              () => setRejecting(false),
              (error: unknown) => {
                onClose();
                toastService.error(
                  getInvitationErrorMessage(
                    error,
                    t('invitationAcceptance.declineFailed'),
                  ),
                );
              },
            );
          },
        },
      ],
    );
  };

  if (!invitation) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon
                name={invitation.type === 'HOME_INVITE' ? 'home' : 'cart'}
                size={32}
                tone="primary"
              />
            </View>
            <Text size="lg" weight="semibold" style={styles.title}>
              {invitation.title}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
              onPress={onClose}
            >
              <Icon name="close" size={24} tone="textSecondary" />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text size="md" style={styles.description}>
              {invitation.description}
            </Text>

            {!!invitation.inviterName && (
              <View style={styles.inviterContainer}>
                <Icon name="person" size={16} tone="textSecondary" />
                <Text size="sm" tone="secondary" style={styles.inviterText}>
                  {t('labels.invitedBy', { name: invitation.inviterName })}
                </Text>
              </View>
            )}

            <View style={styles.entityContainer}>
              <Icon
                name={invitation.type === 'HOME_INVITE' ? 'home' : 'cart'}
                size={16}
                tone="textSecondary"
              />
              <Text
                size="sm"
                tone="secondary"
                weight="medium"
                style={styles.entityText}
              >
                {invitation.entityName}
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.rejectButton,
                pressed && styles.pressed,
              ]}
              onPress={handleReject}
              disabled={accepting || rejecting}
            >
              {rejecting ? (
                <ErrorActivityIndicator />
              ) : (
                <>
                  <Icon name="close" size={20} tone="error" />
                  <Text size="md" weight="semibold" tone="error">
                    {t('labels.reject')}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.acceptButton,
                pressed && styles.pressed,
              ]}
              onPress={handleAccept}
              disabled={accepting || rejecting}
            >
              {accepting ? (
                <WhiteActivityIndicator />
              ) : (
                <>
                  <Icon name="checkmark" size={20} tone="white" />
                  <Text size="md" weight="semibold" style={styles.acceptText}>
                    {t('labels.accept')}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modal: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 8,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.25)',
      },
    ],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  title: {
    flex: 1,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  content: {
    padding: theme.spacing.lg,
  },
  description: {
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  inviterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  inviterText: {
    marginLeft: theme.spacing.xs,
  },
  entityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  entityText: {
    marginLeft: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    paddingTop: 0,
    gap: theme.spacing.sm,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.error + '10',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
  },
  acceptText: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
