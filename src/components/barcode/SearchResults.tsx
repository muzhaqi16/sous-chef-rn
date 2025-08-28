import React from 'react';
import {ScrollView, Alert} from 'react-native';
import {ItemCard} from './ItemCard';
import {ActionButtons} from './ActionButtons';
import {StyleSheet} from 'react-native-unistyles';
interface SearchResultsProps {
  item: any;
  format?: string;
  onScanAnother: () => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  item,
  format,
  onScanAnother,
}) => {
  const handleAddToCart = () => {
    Alert.alert('Success', 'Item action completed!');
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}>
      <ItemCard item={item} format={format} />

      <ActionButtons
        primaryAction={{
          label: 'Add to Cart',
          onPress: handleAddToCart,
        }}
        secondaryAction={{
          label: 'Scan Another',
          onPress: onScanAnother,
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
}));
