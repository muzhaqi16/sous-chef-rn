import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
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
} from '#generated';
import { createAddToQueryFieldUpdater } from '#/apollo/utils/cacheUpdaters';

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
    // Note: This mutation returns a Membership object with homeId.
    // The Home is already in the cache from the invite, so no manual update needed.
    // Apollo will automatically update the membership status via normalization.
  });
  const [acceptShoppingListInvite] = useAcceptShoppingListInviteMutation({
    update: (cache, { data }) => {
      if (!data?.acceptShoppingListInvite?.collaborator) return;

      try {
        const addToShoppingListsCache = createAddToQueryFieldUpdater('shoppingLists');
        addToShoppingListsCache(cache, data.acceptShoppingListInvite.collaborator, { position: 'end' });
      } catch (error) {
        console.warn('Cache update failed for acceptShoppingListInvite:', error);
      }
    },
  });
  const [declineHomeInvite] = useDeclineHomeInviteMutation({
    // Note: Declining an invite doesn't add or remove homes, just changes invite status.
    // No cache update needed.
  });
  const [declineShoppingListInvite] = useDeclineShoppingListInviteMutation();

  const handleAccept = async () => {
    if (!invitation) return;

    setAccepting(true);
    try {
      let token = invitation.token;

      // Fallback: Fetch token if missing (real-time notifications may not include it)
      if (!token && invitation.type === 'SHOPPING_LIST_INVITE') {
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

      if (!token) {
        onClose();
        toastService.error('Unable to find invitation. It may have expired or been cancelled.');
        setAccepting(false);
        return;
      }

      if (invitation.type === 'HOME_INVITE') {
        const result = await acceptHomeInvite({
          variables: {
            token: token!,
          },
        });

        // Check for GraphQL errors (errorPolicy: 'all' returns errors in result, not thrown)
        if (result.error) {
          const errorMessage = result.error.message;
          onClose();
          const message = errorMessage?.includes('expired') || errorMessage?.includes('Invalid')
            ? 'This invitation is no longer valid. It may have expired or already been used.'
            : errorMessage || 'Failed to accept invitation. Please try again.';
          toastService.error(message);
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
        }
      } else if (invitation.type === 'SHOPPING_LIST_INVITE') {
        const result = await acceptShoppingListInvite({
          variables: {
            token: token!,
          },
        });

        // Check for GraphQL errors (errorPolicy: 'all' returns errors in result, not thrown)
        if (result.error) {
          const errorMessage = result.error.message;
          onClose();
          const message = errorMessage?.includes('expired') || errorMessage?.includes('Invalid')
            ? 'This invitation is no longer valid. It may have expired or already been used.'
            : errorMessage || 'Failed to accept invitation. Please try again.';
          toastService.error(message);
          return;
        }

        if (result.data?.acceptShoppingListInvite?.success) {
          onAccept?.(invitation);
          onClose();
        }
      }
    } catch (error: any) {
      // Close modal immediately to prevent stale UI
      onClose();
      // Show non-blocking toast with contextual message
      const message = error.message?.includes('expired') || error.message?.includes('Invalid')
        ? 'This invitation is no longer valid. It may have expired or already been used.'
        : error.message || 'Failed to accept invitation. Please try again.';
      toastService.error(message);
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!invitation) return;

    // Show confirmation alert
    Alert.alert(
      'Decline Invitation',
      `Are you sure you want to decline this invitation to ${invitation.entityName}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              let token = invitation.token;

              // Fallback: Fetch token if missing (real-time notifications may not include it)
              if (!token && invitation.type === 'SHOPPING_LIST_INVITE') {
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

              if (!token) {
                onClose();
                toastService.error('Unable to find invitation. It may have expired or been cancelled.');
                setRejecting(false);
                return;
              }

              if (invitation.type === 'HOME_INVITE') {
                const result = await declineHomeInvite({
                  variables: {token: token!},
                });

                // Check for GraphQL errors (errorPolicy: 'all' returns errors in result, not thrown)
                if (result.error) {
                  const errorMessage = result.error.message;
                  onClose();
                  const message = errorMessage?.includes('expired') || errorMessage?.includes('Invalid')
                    ? 'This invitation is no longer valid. It may have expired or already been used.'
                    : errorMessage || 'Failed to decline invitation. Please try again.';
                  toastService.error(message);
                  return;
                }

                Alert.alert(
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
              } else if (invitation.type === 'SHOPPING_LIST_INVITE') {
                const result = await declineShoppingListInvite({
                  variables: {token: token!},
                });

                // Check for GraphQL errors (errorPolicy: 'all' returns errors in result, not thrown)
                if (result.error) {
                  const errorMessage = result.error.message;
                  onClose();
                  const message = errorMessage?.includes('expired') || errorMessage?.includes('Invalid')
                    ? 'This invitation is no longer valid. It may have expired or already been used.'
                    : errorMessage || 'Failed to decline invitation. Please try again.';
                  toastService.error(message);
                  return;
                }

                Alert.alert(
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
              }
            } catch (error: any) {
              // Close modal immediately to prevent stale UI
              onClose();
              // Show non-blocking toast with contextual message
              const message = error.message?.includes('expired') || error.message?.includes('Invalid')
                ? 'This invitation is no longer valid. It may have expired or already been used.'
                : error.message || 'Failed to decline invitation. Please try again.';
              toastService.error(message);
            } finally {
              setRejecting(false);
            }
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
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon
                name={
                  invitation.type === 'HOME_INVITE' ? 'home' : 'shopping-cart'
                }
                size={32}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.title}>{invitation.title}</Text>
            <Pressable style={({pressed}) => [styles.closeButton, pressed && styles.pressed]} onPress={onClose}>
              <Icon name="close" size={24} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.description}>{invitation.description}</Text>

            {!!invitation.inviterName && (
              <View style={styles.inviterContainer}>
                <Icon name="person" size={16} color={theme.colors.textSecondary} />
                <Text style={styles.inviterText}>
                  Invited by {invitation.inviterName}
                </Text>
              </View>
            )}

            <View style={styles.entityContainer}>
              <Icon
                name={
                  invitation.type === 'HOME_INVITE' ? 'home' : 'shopping-cart'
                }
                size={16}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.entityText}>{invitation.entityName}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable
              style={({pressed}) => [styles.button, styles.rejectButton, pressed && styles.pressed]}
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
              style={({pressed}) => [styles.button, styles.acceptButton, pressed && styles.pressed]}
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
    elevation: 8,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
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
