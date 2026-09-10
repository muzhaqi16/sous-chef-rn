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
import { localizedErrorMessage } from '#/services/errorService';
import { useInvitationActions } from '#features/notifications/hooks/useInvitationActions';
import type { InvitationRefusal } from '#/domain/invitationRefusal';
import { useUser } from '#store/useAppStore';
import type { InvitationData } from '#features/notifications/types';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';
import { Text } from '#components/atoms/Text';

// The caller's copy goes INTO the resolver, never after it: the resolver is
// total and yields to this fallback on a transport code.
const getInvitationErrorMessage = (error: unknown, fallback: string): string =>
  localizedErrorMessage(error, fallback);

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

  /**
   * Copy per refusal reason. The account-mismatch sentence belongs only to the
   * permission refusal that means it; a spent or revoked invite gets copy
   * written for that, and every remaining reason still reaches the reader.
   */
  const reportRefusal = (
    refusal: InvitationRefusal | undefined,
    fallbackKey: string,
  ) => {
    onClose();
    if (refusal === 'inviteeMismatch') {
      // The link is good and the invite stays PENDING — the reader is signed
      // in as somebody else, which no retry fixes and no eviction should hide.
      alertService.alert(
        t('invitationAcceptance.wrongAccountTitle'),
        t('invitationAcceptance.wrongAccount'),
      );
      return;
    }
    if (refusal === 'unavailable' || refusal === 'alreadyResolved') {
      toastService.error(t('errors.invitationUnavailable'));
      return;
    }
    if (refusal === 'invalid') {
      toastService.error(t('invitationAcceptance.invalidInvitation'));
      return;
    }
    toastService.error(t(fallbackKey));
  };

  const handleAccept = () => {
    if (!invitation || !token) return;

    setAccepting(true);
    executeAsyncWithCleanup(
      async () => {
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

        if (!outcome.accepted) {
          reportRefusal(outcome.refusal, 'invitationAcceptance.acceptFailed');
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
            if (!token) return;
            setRejecting(true);
            executeAsyncWithCleanup(
              async () => {
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

                if (!outcome.accepted) {
                  reportRefusal(
                    outcome.refusal,
                    'invitationAcceptance.declineFailed',
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
            <Text role="heading" style={styles.title}>
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
            <Text style={styles.description}>{invitation.description}</Text>

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
                    <Text role="bodyStrong" tone="error">
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
