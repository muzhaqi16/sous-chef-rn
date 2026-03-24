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
import { View, Text, Pressable } from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useStandardBottomSheet } from '#hooks/useStandardBottomSheet';
import { ExpirationAction } from '#generated';
import { NotificationItem } from '#store/slices/notificationSlice';
import { Title } from '#components/atoms/Title';

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
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
}[] = [
  {
    action: ExpirationAction.Cooked,
    label: 'Cooked',
    icon: 'restaurant',
  },
  {
    action: ExpirationAction.Consumed,
    label: 'Consumed',
    icon: 'checkmark-circle',
  },
  {
    action: ExpirationAction.Shared,
    label: 'Shared with someone',
    icon: 'share-social',
  },
  {
    action: ExpirationAction.Extended,
    label: 'Extended shelf life',
    icon: 'calendar',
  },
  {
    action: ExpirationAction.Waste,
    label: 'Wasted / Discarded',
    icon: 'trash',
    destructive: true,
  },
  {
    action: ExpirationAction.NoAction,
    label: 'No action taken',
    icon: 'close-circle',
  },
];

const getExpirySubtitle = (
  daysUntilExpiry: number | null | undefined,
): string => {
  if (daysUntilExpiry == null) return 'Expiring soon';
  if (daysUntilExpiry <= 0) return 'Already expired';
  if (daysUntilExpiry === 1) return 'Expires tomorrow';
  return `Expires in ${daysUntilExpiry} days`;
};

export const ExpirationActionSheet: React.FC<ExpirationActionSheetProps> = ({
  visible,
  notification,
  onActionSelected,
  onDismiss,
}) => {
  const { theme } = useUnistyles();

  // State-driven presentation via visible prop (no manual ref access during render)
  const { ref, modalProps, insets } = useStandardBottomSheet({
    visible,
    onDismiss,
    snapPoints: ['50%'],
  });

  const itemName = notification?.pantryItemName || 'this item';
  const subtitle = notification
    ? getExpirySubtitle(notification.daysUntilExpiry)
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
        <Title style={styles.title}>{`What happened with ${itemName}?`}</Title>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.optionsList}>
          {EXPIRATION_ACTIONS.map((option, index) => (
            <Pressable
              key={option.action}
              style={({ pressed }) => [
                styles.optionButton,
                index < EXPIRATION_ACTIONS.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                },
                pressed && styles.pressed,
              ]}
              onPress={() =>
                notification && onActionSelected(notification, option.action)
              }
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <Ionicons
                name={option.icon}
                size={24}
                color={
                  option.destructive ? theme.colors.error : theme.colors.primary
                }
              />
              <Text
                style={[
                  styles.optionLabel,
                  option.destructive && { color: theme.colors.error },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
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
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  optionsList: {
    borderRadius: theme.radii.lg,
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
  },
  optionLabel: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
}));
