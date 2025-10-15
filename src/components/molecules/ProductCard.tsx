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
    <View
      style={{
        backgroundColor: theme.colors.background,
        padding: 16,
        borderRadius: 8,
        marginBottom: 10,
      }}>
      <Text style={styles.text}>
        {name} - ${price}
      </Text>
      <Button onPress={onAddToCart}>Add to Cart</Button>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  text: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.textPrimary || '#000',
  },
}));

export default ProductCard;
