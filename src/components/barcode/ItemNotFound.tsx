import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon} from '#utils/iconUtils';
import {Button} from '#components/base/Button';

interface ItemNotFoundProps {
  barcode: string;
  onAddItem?: () => void;
}

export const ItemNotFound: React.FC<ItemNotFoundProps> = ({barcode, onAddItem}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      <Text style={styles.notFoundIcon}>
        <Icon name="qr-code-outline" size={48} color={theme.colors.textSecondary} />
      </Text>
      <Text style={styles.notFoundText}>Item Not Found</Text>
      <Text style={styles.notFoundMessage}>
        No item found with barcode: {barcode}
      </Text>
      <Text style={styles.addItemHint}>
        You can add this item to the database by tapping the button below.
      </Text>
      {!!onAddItem && (
        <Button
          onPress={onAddItem}
          variant="primary"
          size="medium">
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
  notFoundText: {
    fontSize: theme.fonts.size.xl,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  notFoundMessage: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  addItemHint: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.primary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: theme.spacing.sm,
  },
  addButton: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
}));
