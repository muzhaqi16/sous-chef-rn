import React from 'react';
import { useTranslation } from '#i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#components/atoms/Icon';
import { commonStyles } from '#styles/commonStyles';
import { Text } from '#components/atoms/Text';
import { AppPressable } from '#components/atoms/AppPressable';
import { EmptyState } from '#components/molecules/EmptyState';
import { DetailSection } from '#components/molecules/DetailSection';

export interface InfoRowData {
  label: string;
  value: string | number;
}

interface ClickableInfoPanelProps {
  title: string;
  items: InfoRowData[];
  onPress: () => void;
  emptyMessage?: string;
}

/** A detail section summing up a history; its rows open the whole of it. */

export const ClickableInfoPanel: React.FC<ClickableInfoPanelProps> = ({
  title,
  items,
  onPress,
  emptyMessage,
}) => {
  const { t } = useTranslation();
  const hasItems = items.length > 0;

  return (
    <DetailSection title={title}>
      {hasItems ? (
        <AppPressable onPress={onPress}>
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
            <Icon name="chevron-forward" size="sm" />
          </View>
        </AppPressable>
      ) : (
        <EmptyState
          size="compact"
          title={emptyMessage ?? t('labels.noDataAvailable')}
        />
      )}
    </DetailSection>
  );
};

const styles = StyleSheet.create(theme => ({
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
}));
