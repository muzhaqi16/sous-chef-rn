import React from 'react';
import {View, Text} from 'react-native';
import {Button} from "../base/Button";
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

interface ProductCardProps {
  name: string;
  price: number;
  onAddToCart: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  name,
  price,
  onAddToCart,
}) => {
  const {theme} = useUnistyles();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {name} - ${price}
      </Text>
      <Button onPress={onAddToCart}>Add to Cart</Button>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing.sm + 2,
  },
  text: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: 'bold',
    marginBottom: theme.spacing.sm + 2,
    color: theme.colors.textPrimary,
  },
}));

export default ProductCard;
