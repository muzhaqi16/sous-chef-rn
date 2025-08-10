import React from 'react';
import {
  View,
  Text,
  ImageSourcePropType,
  TouchableOpacity,
  Image,
} from 'react-native';
import {SwipeableRow} from '#/components';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export interface PantryItem {
  id: string;
  itemName: string;
  quantity: string;
  location: string;
  expirationText: string; // e.g. "Expired 2 days ago" or "Expiring in 2 days!"
  icon: ImageSourcePropType;
}

export interface SwipeablePantryItemProps {
  item: PantryItem;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export const SwipeablePantryItem: React.FC<SwipeablePantryItemProps> = ({
  item,
  onDelete,
  onEdit,
}) => {
  const {styles} = useStyles(stylesheet);
  const renderLeft = () => (
    <TouchableOpacity style={styles.leftAction} onPress={() => onEdit(item.id)}>
      <Text style={styles.actionText}>✏️ Edit</Text>
    </TouchableOpacity>
  );

  const renderRight = () => (
    <TouchableOpacity
      style={styles.rightAction}
      onPress={() => onDelete(item.id)}>
      <Text style={styles.actionText}>🗑️ Delete</Text>
    </TouchableOpacity>
  );

  const isExpired = item.expirationText.toLowerCase().startsWith('expired');

  return (
    <SwipeableRow
      renderLeftActions={renderLeft}
      renderRightActions={renderRight}
      containerStyle={styles.rowContainer}>
      <View style={styles.card}>
        <Image source={item.icon} style={styles.icon} />
        <View style={styles.info}>
          <Text style={styles.title}>{item.itemName}</Text>
          <Text style={styles.qty}>{item.quantity}</Text>
          <Text
            style={[
              styles.expiry,
              isExpired ? styles.expiredText : styles.expiringText,
            ]}>
            {item.expirationText}
          </Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.location}</Text>
        </View>
      </View>
    </SwipeableRow>
  );
};

const stylesheet = createStyleSheet(theme => ({
  rowContainer: {
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    // shadow on iOS
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    // elevation on Android
    elevation: 2,
    backgroundColor: theme.colors.background,
  },
  card: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.black,
  },
  qty: {
    fontSize: 14,
    color: theme.colors.black,
    marginTop: 2,
  },
  expiry: {
    fontSize: 13,
    marginTop: 4,
  },
  expiredText: {
    color: theme.colors.error,
  },
  expiringText: {
    color: theme.colors.success,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: theme.colors.textOnSurfaceVariant,
  },
  footer: {
    position: 'absolute',
    bottom: 4,
    left: 16,
    right: 16,
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // swipe actions
  leftAction: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: 20,
  },
  rightAction: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: theme.colors.errorContainer,
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  actionText: {
    color: theme.colors.onPrimaryContainer,
    fontWeight: '600',
  },
}));
