import React from 'react';
import {ScrollView, Alert, StyleSheet} from 'react-native';
import {ItemCard} from './ItemCard';
import {ActionButtons} from './ActionButtons';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
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
  const {styles, theme} = useStyles(stylesheet);

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

const stylesheet = createStyleSheet(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
}));
