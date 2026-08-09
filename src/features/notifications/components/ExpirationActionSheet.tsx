/**
 * ExpirationActionSheet
 *
 * Bottom sheet presenting expiration action options when a user taps
 * an expiring-item notification. Uses useStandardBottomSheet with
 * visible prop for state-driven presentation (avoids ref access during render).
 *
 * Follows the RecipeDetail option button pattern: Pressable rows with
 * Ionicons inside a BottomSheetModal.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModal } from '#hooks/useStandardBottomSheet';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { StyleSheet } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { ExpirationAction } from '#/graphql/generated/schemaTypes';
import { NotificationItem } from '#store/slices/notificationSlice';
import { Icon } from '#utils/iconUtils';
import { Title } from '#components/atoms/Title';
import { Text } from '#components/atoms/Text';

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
  labelKey: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
}[] = [
  {
    action: ExpirationAction.Cooked,
    labelKey: 'expirationAction.cooked',
    icon: 'restaurant',
  },
  {
    action: ExpirationAction.Consumed,
    labelKey: 'expirationAction.consumed',
    icon: 'checkmark-circle',
  },
  {
    action: ExpirationAction.Shared,
    labelKey: 'expirationAction.shared',
    icon: 'share-social',
  },
  {
    action: ExpirationAction.Extended,
    labelKey: 'expirationAction.extended',
    icon: 'calendar',
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
  daysUntilExpiry: number | null | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  if (daysUntilExpiry == null) return t('expirationAction.expiringSoon');
  if (daysUntilExpiry <= 0) return t('expirationAction.alreadyExpired');
  if (daysUntilExpiry === 1) return t('expiration.expiresTomorrow');
  return t('expiration.expiresInDays', { count: daysUntilExpiry });
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
  styles.useVariants({
    notLast: !isLast,
    destructive: option.destructive ?? false,
  });
  return (
    <AppPressable
      style={styles.optionButton}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(option.labelKey)}
    >
      <Icon
        name={option.icon as string}
        size={24}
        tone={option.destructive ? 'error' : 'primary'}
      />
      <Text size="md" weight="medium" style={styles.optionLabel}>
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
  // State-driven presentation via visible prop (no manual ref access during render)
  const { ref, modalProps, insets } = useStandardBottomSheet({
    visible,
    onDismiss,
    snapPoints: ['50%'],
  });

  const itemName =
    notification?.pantryItemName || t('expirationAction.thisItem');
  const subtitle = notification
    ? getExpirySubtitle(notification.daysUntilExpiry, t)
    : '';

  return (
    <BottomSheetModal
      ref={ref}
      {...modalProps}
      index={0}
      handleIndicatorStyle={{ backgroundColor: 'gray' }}
    >
      <BottomSheetScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Title style={styles.title}>
          {t('expirationAction.title', { itemName })}
        </Title>
        <Text size="sm" tone="secondary" style={styles.subtitle}>
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
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },

  contentContainer: {
    padding: theme.spacing.md,
  },

  title: {
    marginBottom: theme.spacing.xs,
  },

  subtitle: {
    marginBottom: theme.spacing.md,
  },

  optionsList: {
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
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
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
      },
    },
  },

  optionLabel: {
    flex: 1,
    variants: {
      destructive: {
        true: { color: theme.colors.error },
      },
    },
  },
}));
