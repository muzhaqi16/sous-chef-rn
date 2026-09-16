import React, { useState } from 'react';
import { View, Modal } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import {
  ErrorActivityIndicator,
  OnPrimaryActivityIndicator,
} from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { toastService } from '#/services/toastService';
import {
  useInvitationActions,
  type InvitationFailure,
} from '#features/notifications/hooks/useInvitationActions';
import { useUser } from '#store/useAppStore';
import type { InvitationData } from '#features/notifications/types';
import { getNotificationCopy } from '#features/notifications/utils/notificationHelpers';
import { ErrorCode, NotificationType } from '#/graphql/generated/schemaTypes';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';

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
  const { t } = useTranslation();
  const user = useUser();
  const userId = user?.id ?? null;
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const { token, acceptHome, acceptList, declineHome, declineList } =
    useInvitationActions(invitation, userId);

  const reportFailure = (failure: InvitationFailure) => {
    onClose();
    // The invite stays PENDING for a reader signed in as somebody else, which
    // no retry fixes, so it is explained rather than toasted.
    if (failure.code === ErrorCode.Forbidden) {
      alertService.alert(failure.title, failure.body);
      return;
    }
    toastService.error(failure.body);
  };

  const handleAccept = () => {
    if (!invitation || !token) return;

    setAccepting(true);
    void executeAsyncWithCleanup(
      async () => {
        const outcome =
          invitation.type === 'HOME_INVITE'
            ? await acceptHome(token)
            : await acceptList(token);

        if (outcome.status === 'failed') {
          reportFailure(outcome.failure);
          return;
        }

        // The homeId travels with the invitation so the handler can select it.
        onAccept?.(
          outcome.acceptedHomeId
            ? { ...invitation, acceptedHomeId: outcome.acceptedHomeId }
            : invitation,
        );
        onClose();
      },
      () => setAccepting(false),
      () => {
        onClose();
        toastService.error(t('invitationAcceptance.acceptFailed'));
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
            if (!token) return;
            setRejecting(true);
            void executeAsyncWithCleanup(
              async () => {
                const outcome =
                  invitation.type === 'HOME_INVITE'
                    ? await declineHome(token)
                    : await declineList(token);

                if (outcome.status === 'failed') {
                  reportFailure(outcome.failure);
                  return;
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
              () => {
                onClose();
                toastService.error(t('invitationAcceptance.declineFailed'));
              },
            );
          },
        },
      ],
    );
  };

  if (!invitation) return null;

  const copy = getNotificationCopy(
    {
      type:
        invitation.type === 'HOME_INVITE'
          ? NotificationType.HomeInvitation
          : NotificationType.CollaborationInvite,
      payload: invitation.payload,
    },
    t,
  );

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
            <Text role="heading" style={styles.title}>
              {copy.title}
            </Text>
            <AppPressable
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel={t('labels.close')}
            >
              <Icon name="close" size={24} tone="textSecondary" />
            </AppPressable>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text role="body" style={styles.description}>
              {copy.message}
            </Text>

            {!!invitation.inviterName && (
              <View style={styles.inviterContainer}>
                <Icon name="person" size={16} tone="textSecondary" />
                <Text
                  role="caption"
                  tone="secondary"
                  style={styles.inviterText}
                >
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
              <Text role="label" tone="secondary" style={styles.entityText}>
                {invitation.entityName}
              </Text>
            </View>
          </View>

          {/* Actions. The token rides in the notification that delivered this
              invite and the API discloses it once, so a surface holding none
              says where the invite can be opened rather than offering a
              control that has nothing to send. */}
          {!token ? (
            <View style={styles.unavailable}>
              <Text role="caption" tone="secondary">
                {t('invitationAcceptance.unavailableHere')}
              </Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <AppPressable
                style={styles.rejectButton}
                onPress={handleReject}
                disabled={accepting || rejecting}
              >
                {rejecting ? (
                  <ErrorActivityIndicator />
                ) : (
                  <>
                    <Icon name="close" size={20} tone="error" />
                    <Text role="bodyStrong" tone="danger">
                      {t('labels.reject')}
                    </Text>
                  </>
                )}
              </AppPressable>

              <AppPressable
                style={styles.acceptButton}
                onPress={handleAccept}
                disabled={accepting || rejecting}
              >
                {accepting ? (
                  <OnPrimaryActivityIndicator />
                ) : (
                  <>
                    <Icon name="checkmark" size={20} tone="onPrimary" />
                    <Text role="bodyStrong" style={styles.acceptText}>
                      {t('labels.accept')}
                    </Text>
                  </>
                )}
              </AppPressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modal: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: theme.borderWidth.hairline,
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
  unavailable: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
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
    borderCurve: 'continuous',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.error + '10',
    borderWidth: theme.borderWidth.hairline,
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
    borderCurve: 'continuous',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
  },
  acceptText: {
    color: theme.colors.onPrimary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
