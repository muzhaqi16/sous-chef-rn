import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { CachedImage } from '#components/atoms/CachedImage';
import { Text } from '#components/atoms/Text';

interface IngredientCardProps {
  ingredient: any;
  isAdded: boolean;
  onPress: () => void;
}

export const IngredientCard: React.FC<IngredientCardProps> = ({
  ingredient,
  isAdded,
  onPress,
}) => {
  const ingredientName = ingredient.name || 'Unknown';
  const quantity = ingredient.quantity || ingredient.amount || '';
  const unit =
    ingredient.unit?.symbol || ingredient.measures?.us?.unitShort || '';
  const imageUrl = ingredient.image
    ? ingredient.image.startsWith('http')
      ? ingredient.image // Already full URL from backend
      : `https://spoonacular.com/cdn/ingredients_100x100/${ingredient.image}` // Filename needs URL
    : ingredient.item?.imageUrl;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
      disabled={isAdded}
    >
      {imageUrl ? (
        <CachedImage uri={imageUrl} style={styles.image} displaySize={64} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Icon name="leaf-outline" size={32} tone="textSecondary" />
        </View>
      )}
      <Text
        size="xs"
        tone="secondary"
        style={styles.quantity}
        numberOfLines={1}
      >
        {quantity} {unit}
      </Text>
      <Text size="sm" weight="medium" align="center" numberOfLines={2}>
        {ingredientName}
      </Text>
      {isAdded ? (
        <View style={styles.addedBadge}>
          <Icon name="checkmark" size={12} tone="onPrimary" />
        </View>
      ) : (
        <View style={styles.addButton}>
          <Icon name="add" size={16} tone="primary" />
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    width: 100,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.sm,
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 2,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.1)',
      },
    ],
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceVariant,
  },
  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.md,
    marginBottom: theme.spacing.xs,
    backgroundColor: theme.colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    marginBottom: 2,
  },
  addedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
