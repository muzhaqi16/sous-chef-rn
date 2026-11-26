/**
 * Expiration action options, shown when a user taps an expiring-item
 * notification.
 */

import React from 'react';
import { useTranslation, type TranslationKey } from '#i18n';
import type { Translate } from '#i18n/types';
import { daysUntilExpiry, expiryLabel } from '#domain/expiry';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { Sheet } from '#components/templates/Sheet';
import { StyleSheet } from 'react-native-unistyles';
import { ExpirationAction } from '#graphql/generated/schemaTypes';
import type { DisplayNotification as NotificationItem } from '#features/notifications/utils/toDisplayNotification';
import { Icon, type IconName } from '#components/atoms/Icon';
import { Text } from '#components/atoms/Text';
import { firstNonBlank } from '#utils/firstNonBlank';
import { useToday } from '#hooks/app/useToday';

interface ExpirationActionSheetProps {
  visible: boolean;
  notification: NotificationItem | null;
  onActionSelected: (
    notification: NotificationItem,
    action: ExpirationAction,
  ) => void;
  onDismiss: () => void;
}

// Module-level constant — React Compiler auto-memoizes
const EXPIRATION_ACTIONS: {
  action: ExpirationAction;
  /** i18n key path — this table is module-level, no hook. */
  labelKey: TranslationKey;
  icon: IconName;
  destructive?: boolean;
}[] = [
  {
    action: ExpirationAction.Cooked,
    labelKey: 'expirationAction.cooked',
    icon: 'restaurant',
  },
  {
    action: ExpirationAction.Consumed,
    labelKey: 'usagePurpose.GENERAL',
    icon: 'checkmark-circle',
  },
  {
    action: ExpirationAction.Shared,
    labelKey: 'expirationAction.shared',
    icon: 'share-social',
  },
  {
    action: ExpirationAction.Waste,
    labelKey: 'expirationAction.wasted',
    icon: 'trash',
    destructive: true,
  },
  {
    action: ExpirationAction.NoAction,
    labelKey: 'expirationAction.noAction',
    icon: 'close-circle',
  },
];

const getExpirySubtitle = (
  expiresOn: string | null | undefined,
  today: string,
  t: Translate,
): string => {
  if (!expiresOn) return t('expirationAction.expiringSoon');
  return expiryLabel(daysUntilExpiry(expiresOn, today), t);
};

function OptionRow({
  option,
  isLast,
  onPress,
}: {
  option: (typeof EXPIRATION_ACTIONS)[number];
  isLast: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const variantStyles = styles.useVariants({ notLast: !isLast });
  return (
    <AppPressable
      style={variantStyles.optionButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(option.labelKey)}
    >
      <Icon
        name={option.icon}
        size="md"
        tone={option.destructive ? 'error' : 'primary'}
      />
      <Text
        role="bodyStrong"
        tone={option.destructive ? 'danger' : undefined}
        style={variantStyles.optionLabel}
      >
        {t(option.labelKey)}
      </Text>
    </AppPressable>
  );
}

export const ExpirationActionSheet: React.FC<ExpirationActionSheetProps> = ({
  visible,
  notification,
  onActionSelected,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const today = useToday();

  const itemName =
    firstNonBlank(notification?.pantryItemName) ??
    t('expirationAction.thisItem');
  const subtitle = notification
    ? getExpirySubtitle(notification.expiresOn, today, t)
    : '';

  return (
    <Sheet
      mode="action"
      visible={visible}
      onDismiss={onDismiss}
      snapPoints={[]}
      enableDynamicSizing
      title={t('expirationAction.title', { itemName })}
      contentContainerStyle={styles.contentContainer}
    >
      <Text role="caption" tone="secondary" style={styles.subtitle}>
        {subtitle}
      </Text>
      <View style={styles.optionsList}>
        {EXPIRATION_ACTIONS.map((option, index) => (
          <OptionRow
            key={option.action}
            option={option}
            isLast={index === EXPIRATION_ACTIONS.length - 1}
            onPress={() => {
              if (notification) {
                onActionSelected(notification, option.action);
              }
            }}
          />
        ))}
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create(theme => ({
  contentContainer: {
    paddingVertical: theme.spacing.md,
  },

  subtitle: {
    marginBottom: theme.spacing.md,
  },

  optionsList: {
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.borderLight,
  },

  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    variants: {
      notLast: {
        true: {
          borderBottomWidth: theme.borderWidth.hairline,
          borderBottomColor: theme.colors.border,
        },
      },
    },
  },

  optionLabel: {
    flex: 1,
  },
}));
