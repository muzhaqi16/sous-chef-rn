import React, { useState } from 'react';
import { View, Modal } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import {
  ErrorActivityIndicator,
  WhiteActivityIndicator,
} from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { Icon } from '#utils/iconUtils';
import { toastService } from '#/services/toastService';
import { t as tGlobal } from '#/i18n';
import { useInvitationActions } from '#features/notifications/hooks/useInvitationActions';
import { useUser } from '#store/useAppStore';
import type { InvitationData } from '#features/notifications/types';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';

const getInvitationErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  const msg = (error as Error)?.message?.toLowerCase() || '';
  return msg.includes('expired') || msg.includes('invalid')
    ? tGlobal('errors.invitationExpired')
    : (error as Error)?.message || fallback;
};

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
  const user = useUser();
  const userId = user?.id ?? null;
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const { resolveToken, acceptHome, acceptList, declineHome, declineList } =
    useInvitationActions(invitation, userId);

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

        const outcome =
          invitation.type === 'HOME_INVITE'
            ? await acceptHome(token)
            : await acceptList(token);

        if (outcome.error) {
          onClose();
          toastService.error(
            getInvitationErrorMessage(
              outcome.error,
              t('invitationAcceptance.acceptFailed'),
            ),
          );
          return;
        }

        if (outcome.accepted) {
          // The homeId travels with the invitation so the handler can select it.
          onAccept?.(
            outcome.acceptedHomeId
              ? { ...invitation, acceptedHomeId: outcome.acceptedHomeId }
              : invitation,
          );
          onClose();
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

                const outcome =
                  invitation.type === 'HOME_INVITE'
                    ? await declineHome(token)
                    : await declineList(token);

                if (outcome.error) {
                  onClose();
                  toastService.error(
                    getInvitationErrorMessage(
                      outcome.error,
                      t('invitationAcceptance.declineFailed'),
                    ),
                  );
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
                  <Text size="md" weight="semibold" tone="error">
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
                <WhiteActivityIndicator />
              ) : (
                <>
                  <Icon name="checkmark" size={20} tone="white" />
                  <Text size="md" weight="semibold" style={styles.acceptText}>
                    {t('labels.accept')}
                  </Text>
                </>
              )}
            </AppPressable>
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
    borderCurve: 'continuous',
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
