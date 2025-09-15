import React from 'react';
import {View, Text, Image} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';

interface Item {
  id: string;
  name: string;
  description?: string;
  price?: number;
  barcode: string;
  imageUrl?: string;
}

interface ItemCardProps {
  item: Item;
  format?: string;
}

export const ItemCard: React.FC<ItemCardProps> = ({item, format}) => {
  return (
    <View style={styles.itemCard}>
      {item.imageUrl ? (
        <Image
          source={{uri: item.imageUrl}}
          style={styles.itemImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={styles.placeholderText}>📦</Text>
        </View>
      )}

      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.itemDescription}>{item.description}</Text>
        )}
        {item?.price && (
          <Text style={styles.itemPrice}>${item?.price.toFixed(2)}</Text>
        )}
        <Text style={styles.itemBarcode}>Barcode: {item.barcode}</Text>
        {format && <Text style={styles.itemFormat}>Format: {format}</Text>}
      </View>
    </View>
  );
};
const styles = StyleSheet.create(theme => ({
  itemCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 16,
  },
  placeholderImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 48,
  },
  itemDetails: {
    gap: 8,
  },
  itemName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#212529',
  },
  itemDescription: {
    fontSize: 16,
    color: '#6c757d',
    lineHeight: 22,
  },
  itemPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: '#28a745',
  },
  itemBarcode: {
    fontSize: 14,
    color: '#6c757d',
    fontFamily: 'monospace',
  },
  itemFormat: {
    fontSize: 12,
    color: '#adb5bd',
    textTransform: 'uppercase',
  },
}));
