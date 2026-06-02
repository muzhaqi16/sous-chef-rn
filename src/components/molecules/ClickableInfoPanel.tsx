import React from 'react';
import { View, ViewStyle } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';

export interface InfoRowData {
  label: string;
  value: string | number;
}

interface ClickableInfoPanelProps {
  title: string;
  items: InfoRowData[];
  onPress: () => void;
  emptyMessage?: string;
  style?: ViewStyle;
}

export const ClickableInfoPanel: React.FC<ClickableInfoPanelProps> = ({
  title,
  items,
  onPress,
  emptyMessage,
  style,
}) => {
  const hasItems = items.length > 0;

  return (
    <View style={[styles.container, style]}>
      <Text size="md" weight="semibold" style={styles.title}>
        {title}
      </Text>
      <AppPressable style={styles.panel} onPress={onPress}>
        {hasItems ? (
          <>
            {items.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.infoRow,
                  index === items.length - 1 && styles.lastInfoRow,
                ]}
              >
                <Text
                  tone="secondary"
                  style={[commonStyles.caption, styles.infoLabel]}
                >
                  {item.label}
                </Text>
                <View style={styles.infoValueContainer}>
                  <Text size="sm" weight="medium">
                    {item.value}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.actionRow}>
              <Text size="sm" weight="medium" tone="accent">
                View Details
              </Text>
              <Icon name="chevron-forward" size={20} />
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text size="sm" tone="secondary" style={styles.emptyText}>
              {emptyMessage || 'No data available'}
            </Text>
          </View>
        )}
      </AppPressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  title: {
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 4,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.08)',
      },
    ],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  lastInfoRow: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    flex: 1,
  },
  infoValueContainer: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontStyle: 'italic',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
