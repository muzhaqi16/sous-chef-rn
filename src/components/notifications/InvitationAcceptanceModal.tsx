import React, { useState } from 'react';
import { View, Text, Modal, Pressable, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { alertService } from '#/services/alertService';
import { useApolloClient } from '@apollo/client/react';
import { Icon } from '#utils/iconUtils';
import { toastService } from '#/services/toastService';
import {
  useAcceptHomeInviteMutation,
  useAcceptShoppingListInviteMutation,
  useDeclineHomeInviteMutation,
  useDeclineShoppingListInviteMutation,
  MyShoppingListInvitesDocument,
  MyShoppingListInvitesQuery,
  GetHomesDocument,
  GetMyPendingInvitesDocument,
} from '#generated';
import { createAddToQueryFieldUpdater } from '#/apollo/utils/cacheUpdaters';
import { executeAsyncWithCleanup } from '#/utils/compilerSafeWrappers';

const INVITATION_EXPIRED_MSG =
  'This invitation is no longer valid. It may have expired or already been used.';

const getInvitationErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  const msg = (error as Error)?.message?.toLowerCase() || '';
  return msg.includes('expired') || msg.includes('invalid')
    ? INVITATION_EXPIRED_MSG
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
}

export const InvitationAcceptanceModal: React.FC<
  InvitationAcceptanceModalProps
> = ({ visible, invitation, onClose, onAccept, onReject }) => {
  const { theme } = useUnistyles();
  const client = useApolloClient();
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const [acceptHomeInvite] = useAcceptHomeInviteMutation({
    refetchQueries: [
      { query: GetHomesDocument },
      { query: GetMyPendingInvitesDocument },
    ],
    awaitRefetchQueries: true,
  });
  const [acceptShoppingListInvite] = useAcceptShoppingListInviteMutation({
    refetchQueries: [{ query: MyShoppingListInvitesDocument }],
    update: (cache, { data }) => {
      if (!data?.acceptShoppingListInvite?.collaborator) return;

      try {
        const addToShoppingListsCache =
          createAddToQueryFieldUpdater('shoppingLists');
        addToShoppingListsCache(
          cache,
          data.acceptShoppingListInvite.collaborator,
          { position: 'end' },
        );
      } catch (error) {
        console.warn(
          'Cache update failed for acceptShoppingListInvite:',
          error,
        );
      }
    },
  });
  const [declineHomeInvite] = useDeclineHomeInviteMutation({
    refetchQueries: [{ query: GetMyPendingInvitesDocument }],
  });
  const [declineShoppingListInvite] = useDeclineShoppingListInviteMutation({
    refetchQueries: [{ query: MyShoppingListInvitesDocument }],
  });

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
          onClose();
          toastService.error(
            'Unable to find invitation. It may have expired or been cancelled.',
          );
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
                'Failed to accept invitation. Please try again.',
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
                'Failed to accept invitation. Please try again.',
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
            'Failed to accept invitation. Please try again.',
          ),
        );
      },
    );
  };

  const handleReject = async () => {
    if (!invitation) return;

    // Show confirmation alert
    alertService.alert(
      'Decline Invitation',
      `Are you sure you want to decline this invitation to ${invitation.entityName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            setRejecting(true);
            executeAsyncWithCleanup(
              async () => {
                const token = await resolveToken();

                if (!token) {
                  onClose();
                  toastService.error(
                    'Unable to find invitation. It may have expired or been cancelled.',
                  );
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
                        'Failed to decline invitation. Please try again.',
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
                        'Failed to decline invitation. Please try again.',
                      ),
                    );
                    return;
                  }
                }

                alertService.alert(
                  'Invitation Declined',
                  `You have declined the invitation to ${invitation.entityName}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        onReject?.(invitation);
                        onClose();
                      },
                    },
                  ],
                );
              },
              () => setRejecting(false),
              (error: unknown) => {
                onClose();
                toastService.error(
                  getInvitationErrorMessage(
                    error,
                    'Failed to decline invitation. Please try again.',
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
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.title}>{invitation.title}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
              onPress={onClose}
            >
              <Icon name="close" size={24} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.description}>{invitation.description}</Text>

            {!!invitation.inviterName && (
              <View style={styles.inviterContainer}>
                <Icon
                  name="person"
                  size={16}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.inviterText}>
                  Invited by {invitation.inviterName}
                </Text>
              </View>
            )}

            <View style={styles.entityContainer}>
              <Icon
                name={invitation.type === 'HOME_INVITE' ? 'home' : 'cart'}
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.entityText}>{invitation.entityName}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.rejectButton,
                pressed && styles.pressed,
              ]}
              onPress={handleReject}
              disabled={accepting || rejecting}
            >
              {rejecting ? (
                <ActivityIndicator color={theme.colors.error} />
              ) : (
                <>
                  <Icon name="close" size={20} color={theme.colors.error} />
                  <Text style={[styles.buttonText, styles.rejectText]}>
                    Reject
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.acceptButton,
                pressed && styles.pressed,
              ]}
              onPress={handleAccept}
              disabled={accepting || rejecting}
            >
              {accepting ? (
                <ActivityIndicator color={theme.colors.white} />
              ) : (
                <>
                  <Icon name="checkmark" size={20} color={theme.colors.white} />
                  <Text style={[styles.buttonText, styles.acceptText]}>
                    Accept
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
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  content: {
    padding: theme.spacing.lg,
  },
  description: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    lineHeight: 22,
  },
  inviterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  inviterText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
  },
  entityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  entityText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.xs,
    fontWeight: theme.fonts.weight.medium,
  },
  actions: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    paddingTop: 0,
    gap: theme.spacing.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.md,
    gap: theme.spacing.xs,
  },
  rejectButton: {
    backgroundColor: theme.colors.error + '10',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  acceptButton: {
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
  },
  rejectText: {
    color: theme.colors.error,
  },
  acceptText: {
    color: theme.colors.white,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
