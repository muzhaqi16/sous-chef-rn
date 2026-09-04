import React from 'react';
import { useTranslation } from '#/i18n';
import { View, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import { EmptyState } from '#components/molecules/EmptyState';
import { Card } from '#components/atoms/Card';

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
  const { t } = useTranslation();
  const hasItems = items.length > 0;

  return (
    <View style={[styles.container, style]}>
      <Text role="bodyStrong" style={styles.title}>
        {title}
      </Text>
      <Card padding="none" style={styles.panel} onPress={onPress}>
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
                  <Text role="label">{item.value}</Text>
                </View>
              </View>
            ))}

            <View style={styles.actionRow}>
              <Text role="label" tone="accent">
                {t('labels.viewDetails')}
              </Text>
              <Icon name="chevron-forward" size={20} />
            </View>
          </>
        ) : (
          <EmptyState
            size="compact"
            title={emptyMessage || t('labels.noDataAvailable')}
          />
        )}
      </Card>
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
    borderWidth: theme.borderWidth.hairline,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  lastInfoRow: {
    borderBottomWidth: theme.borderWidth.none,
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
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
