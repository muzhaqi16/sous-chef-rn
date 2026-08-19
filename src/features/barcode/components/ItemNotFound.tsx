import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Button } from '#components/base/Button';
import { Text } from '#components/atoms/Text';

interface ItemNotFoundProps {
  barcode: string;
  onAddItem?: () => void;
}

export const ItemNotFound: React.FC<ItemNotFoundProps> = ({
  barcode,
  onAddItem,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Icon name="qr-code-outline" size={48} tone="textSecondary" />
      <Text size="xl" weight="semibold" align="center">
        {t('barcode.itemNotFound')}
      </Text>
      <Text
        size="sm"
        tone="secondary"
        align="center"
        style={styles.notFoundMessage}
      >
        {t('barcode.noItemWithCode', { barcode })}
      </Text>
      <Text size="sm" tone="accent" align="center" style={styles.addItemHint}>
        {t('barcode.addItemHint')}
      </Text>
      {!!onAddItem && (
        <Button onPress={onAddItem} variant="primary" size="medium">
          {t('barcode.addItem')}
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  notFoundMessage: {
    fontFamily: 'monospace',
  },
  addItemHint: {
    fontStyle: 'italic',
    marginTop: theme.spacing.sm,
  },
  addButton: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
}));
