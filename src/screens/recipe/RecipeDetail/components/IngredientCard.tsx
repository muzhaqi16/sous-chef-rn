import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { CachedImage } from '#components/atoms/CachedImage';

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
  const { theme } = useUnistyles();

  const ingredientName = ingredient.name || 'Unknown';
  const quantity = ingredient.quantity || ingredient.amount || '';
  const unit = ingredient.unit?.symbol || ingredient.measures?.us?.unitShort || '';
  const imageUrl = ingredient.image
    ? ingredient.image.startsWith('http')
      ? ingredient.image // Already full URL from backend
      : `https://spoonacular.com/cdn/ingredients_100x100/${ingredient.image}` // Filename needs URL
    : ingredient.item?.imageUrl;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={isAdded}
      activeOpacity={0.7}
    >
      {imageUrl ? (
        <CachedImage uri={imageUrl} style={styles.image} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="leaf-outline" size={32} color={theme.colors.textSecondary} />
        </View>
      )}
      <Text style={styles.quantity} numberOfLines={1}>
        {quantity} {unit}
      </Text>
      <Text style={styles.name} numberOfLines={2}>
        {ingredientName}
      </Text>
      {isAdded ? (
        <View style={styles.addedBadge}>
          <Ionicons name="checkmark" size={12} color={theme.colors.onPrimary} />
        </View>
      ) : (
        <View style={styles.addButton}>
          <Ionicons name="add" size={16} color={theme.colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  card: {
    width: 100,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  name: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
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
}));
