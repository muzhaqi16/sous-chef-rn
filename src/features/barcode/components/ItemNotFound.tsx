import React from 'react';
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
  return (
    <View style={styles.container}>
      <Text style={styles.notFoundIcon}>
        <Icon name="qr-code-outline" size={48} tone="textSecondary" />
      </Text>
      <Text size="xl" weight="semibold" align="center">
        Item Not Found
      </Text>
      <Text
        size="sm"
        tone="secondary"
        align="center"
        style={styles.notFoundMessage}
      >
        No item found with barcode: {barcode}
      </Text>
      <Text size="sm" tone="accent" align="center" style={styles.addItemHint}>
        You can add this item to the database by tapping the button below.
      </Text>
      {!!onAddItem && (
        <Button onPress={onAddItem} variant="primary" size="medium">
          Add Item
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
  notFoundIcon: {
    fontSize: theme.sizes.avatar.lg,
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
