import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { PrimaryActivityIndicator } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@apollo/client/react';
import Animated, { FadeIn } from 'react-native-reanimated';
import Clipboard from '@react-native-clipboard/clipboard';
import { Text } from '#components/atoms/Text';
import { Icon } from '#utils/iconUtils';
import { ShareShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  executeWithLoadingState,
  unwrapPayload,
} from '#/utils/compilerSafeWrappers';
import { alertService } from '#/services/alertService';
import { getFormAnimationPreset } from '#/constants/animations';

interface ShareCodeSectionProps {
  listId: string;
  isPublic: boolean;
  shareCode: string | null | undefined;
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
}) => {
  const { t } = useTranslation();
  const [shareShoppingList] = useMutation(ShareShoppingListDocument);
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
    executeWithLoadingState(
      async () => {
        const { data } = await shareShoppingList({
          variables: { input: { id: listId, isPublic: !isPublic } },
        });
        unwrapPayload(
          data?.shareShoppingList,
          'ShareShoppingListPayload',
          t('shoppingListScreens.failedToUpdateShareSettings'),
        );
        // No refetch needed: the mutation returns shoppingList { id, shareCode,
        // isPublic } which Apollo normalizes by ShoppingList:${id}.
      },
      setTogglingShareCode,
      error => {
        alertService.alert(
          t('labels.error'),
          error instanceof Error
            ? error.message
            : t('shoppingListScreens.failedToUpdateShareSettings'),
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

  return (
    <View style={styles.shareCodeSection}>
      <Text style={styles.sectionTitle}>
        {t('shoppingListScreens.shareViaCode')}
      </Text>
      <Text style={styles.shareCodeDescription}>
        {t('shoppingListScreens.shareCodeDescription')}
      </Text>
      <AppPressable
        style={styles.shareCodeToggle}
        onPress={handleToggleShareCode}
        disabled={togglingShareCode}
      >
        <Animated.View
          key={isPublic ? 'public-on' : 'public-off'}
          entering={FadeIn.duration(200)}
          style={styles.shareCodeToggleContent}
        >
          <Icon
            name={isPublic ? 'link-outline' : 'lock-closed-outline'}
            size={20}
            tone={isPublic ? 'primary' : 'textSecondary'}
          />
          <Text style={styles.shareCodeToggleText}>
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
        <Animated.View {...getFormAnimationPreset()}>
          <AppPressable
            style={styles.shareCodeDisplay}
            onPress={handleCopyShareCode}
          >
            <Text style={styles.shareCodeValue}>{shareCode}</Text>
            <View style={styles.copyButton}>
              <Icon
                name={copied ? 'checkmark' : 'copy-outline'}
                size={18}
                tone={copied ? 'success' : 'primary'}
              />
              <Text style={[styles.copyText, copied && styles.copyTextCopied]}>
                {copied
                  ? t('shoppingListScreens.copied')
                  : t('shoppingListScreens.copy')}
              </Text>
            </View>
          </AppPressable>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  sectionTitle: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing['3'],
  },
  shareCodeSection: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  shareCodeDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.fontSize.sm * 1.5,
  },
  shareCodeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing['3'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
  },
  shareCodeToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  shareCodeToggleText: {
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    fontWeight: theme.fonts.weight.medium,
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
    backgroundColor: theme.colors.white,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  shareCodeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    padding: theme.spacing['3'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  shareCodeValue: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  copyText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.medium,
  },
  copyTextCopied: {
    color: theme.colors.success,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
