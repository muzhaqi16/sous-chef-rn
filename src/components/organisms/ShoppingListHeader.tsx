// src/organisms/ShoppingListHeader.tsx
import React from 'react';
import {View, Text, Image} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';
import SearchBar from '../molecules/SearchBar';
import IconButton from '../atoms/IconButton';

type Props = {
  searchValue: string;
  onChangeSearch: (text: string) => void;
  onAddItem: () => void;
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    paddingTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.typography,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
}));

const ShoppingListHeader: React.FC<Props> = ({
  searchValue,
  onChangeSearch,
  onAddItem,
}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.title}>PANTRY</Text>
        {/* Placeholder avatar; replace with actual user image */}
        <Image
          style={styles.avatar}
          source={{
            uri: 'https://i.pravatar.cc/300',
          }}
        />
      </View>
      <SearchBar
        value={searchValue}
        onChangeText={onChangeSearch}
        onAddPress={onAddItem}
      />
    </View>
  );
};

export default ShoppingListHeader;
