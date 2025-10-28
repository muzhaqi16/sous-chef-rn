import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';
import { commonStyles } from '#styles';

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
      <Text style={styles.title}>{title}</Text>

      <TouchableOpacity
        style={styles.panel}
        onPress={onPress}
        activeOpacity={0.7}
      >
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
                <Text style={[commonStyles.caption, styles.infoLabel]}>
                  {item.label}
                </Text>
                <View style={styles.infoValueContainer}>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              </View>
            ))}

            <View style={styles.actionRow}>
              <Text style={styles.actionText}>View Details</Text>
              <Icon name="chevron-forward" size={20} library="Ionicons" />
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {emptyMessage || 'No data available'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
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
    color: theme.colors.textSecondary,
  },
  infoValueContainer: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  infoValue: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
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
  actionText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.primary,
  },
  emptyContainer: {
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
}));
