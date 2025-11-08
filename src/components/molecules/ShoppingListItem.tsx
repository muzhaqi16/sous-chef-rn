import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SwipeableItem } from './SwipeableItem';
import { Counter } from './Counter';
import { QuantityDisplay } from './QuantityDisplay';
import { Icon } from '#/utils/iconUtils';
import { DisplayFormat } from '#/graphql/generated';

interface ShoppingListItemProps {
  id: string;
  name: string;
  quantity: number;
  quantityInput?: string | null;
  displayFormat?: DisplayFormat | null;
  unit?: string;
  displayAsFraction?: boolean | null;
  imageUrl?: string;
  isPurchased: boolean;
  onToggle: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export const ShoppingListItem: React.FC<ShoppingListItemProps> = ({
  id,
  name,
  quantity,
  quantityInput,
  displayFormat,
  unit,
  displayAsFraction,
  imageUrl,
  isPurchased,
  onToggle,
  onUpdateQuantity,
  onDelete,
  onEdit,
}) => {
  const { theme } = useUnistyles();
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(quantity);

  const handleQuantityUpdate = () => {
    onUpdateQuantity(id, localQuantity);
    setIsEditingQuantity(false);
  };

  return (
    <SwipeableItem onDelete={() => onDelete(id)} onEdit={() => onEdit(id)}>
      <View
        style={[styles.container, isPurchased && styles.purchasedContainer]}
      >
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => onToggle(id)}
        >
          <View
            style={[styles.checkbox, isPurchased && styles.checkboxChecked]}
          >
            {isPurchased && <Icon name="check" size={16} color="white" />}
          </View>
        </TouchableOpacity>

        {imageUrl && (
          <Image source={{ uri: imageUrl }} style={styles.itemImage} />
        )}

        <View style={styles.contentContainer}>
          <Text style={[styles.itemName, isPurchased && styles.purchasedText]}>
            {name}
          </Text>

          {isEditingQuantity ? (
            <View style={styles.editQuantityContainer}>
              <Counter
                count={localQuantity}
                onIncrement={() => setLocalQuantity(q => q + 1)}
                onDecrement={() => setLocalQuantity(q => Math.max(1, q - 1))}
              />
              <TouchableOpacity onPress={handleQuantityUpdate}>
                <Icon name="check" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.quantityContainer}
              onPress={() => setIsEditingQuantity(true)}
            >
              <QuantityDisplay
                quantity={quantity}
                quantityInput={quantityInput}
                displayFormat={displayFormat}
                unitSymbol={unit}
                displayAsFraction={displayAsFraction}
                style={{
                  ...styles.quantityText,
                  ...(isPurchased ? styles.purchasedText : {}),
                }}
              />
              <Icon name="edit" size={14} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SwipeableItem>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  purchasedContainer: {
    opacity: 0.6,
    backgroundColor: theme.colors.surfaceVariant,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  itemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  purchasedText: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginRight: 4,
  },
  editQuantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
}));
