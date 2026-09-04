import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import Animated, { FadeIn } from 'react-native-reanimated';
import Clipboard from '@react-native-clipboard/clipboard';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { useShareShoppingList } from '#features/shoppingList/hooks/useShareShoppingList';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { unwrapPayload } from '#/utils/errors/mutationPayload';
import { alertService } from '#/services/alertService';
import { localizedErrorMessage } from '#/services/errorService';
import { useVerifiedEmailGate } from '#hooks/auth/useEmailVerification';
import { getFormAnimationPreset } from '#/constants/animations';
import { buildJoinListUrl, shareUrl } from '#/utils/deepLinkUrls';
import { SectionHeader } from '#components/atoms/SectionHeader';
import { motion } from '#/theme/foundations/motion';

interface ShareCodeSectionProps {
  listId: string;
  isPublic: boolean;
  shareCode: string | null | undefined;
  /** Server-built universal share link; falls back to the client builder. */
  shareLinkUrl?: string | null;
}

/**
 * Public share-code section of the Share screen: toggles public sharing and
 * displays/copies the share code. Owns the ShareShoppingList mutation plus its
 * toggle/copied state so the parent screen stays focused on collaborators.
 */
export const ShareCodeSection: React.FC<ShareCodeSectionProps> = ({
  listId,
  isPublic,
  shareCode,
  shareLinkUrl,
}) => {
  const { t } = useTranslation();
  const { requireVerifiedEmail } = useVerifiedEmailGate();
  const { setListPublic } = useShareShoppingList();
  const [togglingShareCode, setTogglingShareCode] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Reset the copied indicator whenever the code itself changes.
  const [prevShareCode, setPrevShareCode] = useState(shareCode);
  if (shareCode !== prevShareCode) {
    setPrevShareCode(shareCode);
    setCopied(false);
  }

  const handleToggleShareCode = () => {
    // Only opening the list up is gated — turning sharing back off is always
    // allowed, so an unverified account is never stuck sharing something.
    if (!isPublic && !requireVerifiedEmail()) return;

    executeWithLoadingState(
      async () => {
        unwrapPayload(
          await setListPublic(listId, !isPublic),
          'ShareShoppingListPayload',
          t('shoppingListScreens.failedToUpdateShareSettings'),
        );
      },
      setTogglingShareCode,
      error => {
        alertService.alert(
          t('labels.error'),
          // Resolved from the error's CODE. `error.message` is the server's
          // English, which reaches an es/it/sq user verbatim.
          localizedErrorMessage(
            error,
            t('shoppingListScreens.failedToUpdateShareSettings'),
          ),
        );
      },
    );
  };

  const handleCopyShareCode = () => {
    if (shareCode) {
      Clipboard.setString(shareCode);
      setCopied(true);
    }
  };

  const handleShareLink = () => {
    if (shareCode) {
      // Prefer the server-built link; fall back to the client builder.
      const url = shareLinkUrl ?? buildJoinListUrl(shareCode);
      void shareUrl(url, t('shoppingListScreens.shareLinkMessage'));
    }
  };

  return (
    <View style={styles.shareCodeSection}>
      <SectionHeader style={styles.sectionTitleSpacing}>
        {t('shoppingListScreens.shareViaCode')}
      </SectionHeader>
      <Text role="caption" style={styles.shareCodeDescription}>
        {t('shoppingListScreens.shareCodeDescription')}
      </Text>
      <AppPressable
        style={styles.shareCodeToggle}
        onPress={handleToggleShareCode}
        disabled={togglingShareCode}
      >
        <Animated.View
          key={isPublic ? 'public-on' : 'public-off'}
          entering={FadeIn.duration(motion.timing.STANDARD)}
          style={styles.shareCodeToggleContent}
        >
          <Icon
            name={isPublic ? 'link-outline' : 'lock-closed-outline'}
            size={20}
            tone={isPublic ? 'primary' : 'textSecondary'}
          />
          <Text role="bodyStrong" style={styles.shareCodeToggleText}>
            {isPublic
              ? t('shoppingListScreens.publicSharingEnabled')
              : t('shoppingListScreens.publicSharingDisabled')}
          </Text>
        </Animated.View>
        <View style={styles.toggleSlot}>
          {togglingShareCode ? (
            <PrimaryActivityIndicator size="small" />
          ) : (
            <View
              style={[styles.toggleTrack, isPublic && styles.toggleTrackActive]}
            >
              <View
                style={[
                  styles.toggleThumb,
                  isPublic && styles.toggleThumbActive,
                ]}
              />
            </View>
          )}
        </View>
      </AppPressable>
      {isPublic && shareCode ? (
        <Animated.View
          {...getFormAnimationPreset()}
          style={styles.shareActionsRow}
        >
          <AppPressable
            style={styles.shareCodeDisplay}
            onPress={handleCopyShareCode}
          >
            <Text
              role="bodyStrong"
              style={styles.shareCodeValue}
              numberOfLines={1}
            >
              {shareCode}
            </Text>
            <Icon
              name={copied ? 'checkmark' : 'copy-outline'}
              size={18}
              tone={copied ? 'success' : 'primary'}
            />
          </AppPressable>
          <AppPressable
            style={styles.shareLinkButton}
            onPress={handleShareLink}
          >
            <Icon name="share-outline" size={18} tone="primary" />
            <Text role="bodyStrong" style={styles.shareLinkText}>
              {t('labels.shareLink')}
            </Text>
          </AppPressable>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  shareCodeSection: {
    padding: theme.spacing.md,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  shareCodeDescription: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  shareCodeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  shareCodeToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  shareCodeToggleText: {
    color: theme.colors.textPrimary,
  },
  toggleSlot: {
    width: 44,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackActive: {
    backgroundColor: theme.colors.primary,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  shareActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  shareCodeDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    padding: theme.spacing.base,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  shareCodeValue: {
    flexShrink: 1,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  shareLinkButton: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.base,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
  },
  shareLinkText: {
    color: theme.colors.primary,
  },
  sectionTitleSpacing: {
    marginBottom: theme.spacing.base,
  },
}));
