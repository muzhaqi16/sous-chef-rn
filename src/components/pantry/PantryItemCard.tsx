import React from 'react';
import { View, Text, Image } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SwipeableItem } from '#components';
import { commonStyles } from '#/styles';

export type ItemVariant = 'normal' | 'warning' | 'expired';

interface PantryItemCardProps {
  id: string;
  emoji: string;
  name: string;
  expirationText: string;
  expirationVariant: 'normal' | 'warning' | 'critical' | 'expired';
  quantity: string;
  location: string;
  variant?: ItemVariant;
  imageUrl?: string | null;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onConsume?: () => void;
  onWaste?: () => void;
  onRestock?: () => void;
  onSwipeableWillOpen?: (ref: any) => void;
}

export const PantryItemCard: React.FC<PantryItemCardProps> = ({
  emoji,
  name,
  expirationText,
  expirationVariant,
  quantity,
  location,
  variant = 'normal',
  imageUrl,
  onPress,
  onEdit,
  onDelete,
  onConsume,
  onWaste,
  onRestock,
  onSwipeableWillOpen,
}) => {
  const { theme } = useUnistyles();

  const getBackgroundStyle = () => {
    switch (variant) {
      case 'warning':
        return {
          backgroundColor: theme.colors.expiration.warningBg,
          borderColor: theme.colors.expiration.warningBorder,
        };
      case 'expired':
        return {
          backgroundColor: theme.colors.expiration.expiredBg,
          borderColor: theme.colors.expiration.expiredBorder,
        };
      default:
        return {
          backgroundColor: theme.colors.white,
          borderColor: theme.colors.borderLight,
        };
    }
  };

  const getEmojiBackgroundColor = () => {
    switch (variant) {
      case 'warning':
        return '#FEF3C7'; // amber-100
      case 'expired':
        return theme.colors.expiration.expiredIconBg;
      default:
        return '#F8FAFC'; // slate-50
    }
  };

  const getExpirationColor = () => {
    switch (expirationVariant) {
      case 'expired':
      case 'critical':
        return theme.colors.expiration.expiredText;
      case 'warning':
        return theme.colors.expiration.warningText;
      default:
        return theme.colors.textSecondary;
    }
  };

  const backgroundStyle = getBackgroundStyle();

  // The card content - displayed inside swipeable or as standalone
  const cardContent = (
    <View style={[styles.container, backgroundStyle]}>
      {/* Image/Emoji Icon */}
      {imageUrl ? (
        <View
          style={[
            commonStyles.listItemImageContainer,
            styles.imageContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Image
            source={{ uri: imageUrl }}
            style={[commonStyles.listItemImage, { resizeMode: 'contain' }]}
          />
        </View>
      ) : (
        <View
          style={[styles.emojiContainer, { backgroundColor: getEmojiBackgroundColor() }]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text
          style={[
            styles.expiration,
            { color: getExpirationColor() },
            expirationVariant !== 'normal' && styles.expirationBold,
          ]}
        >
          {expirationText}
        </Text>
      </View>

      {/* Quantity & Location */}
      <View style={styles.meta}>
        <Text style={styles.quantity}>{quantity}</Text>
        <Text style={styles.location}>{location}</Text>
      </View>
    </View>
  );

  // If we have swipe actions, wrap in SwipeableItem
  const hasSwipeActions = onEdit || onDelete || onConsume || onWaste || onRestock;

  if (hasSwipeActions) {
    return (
      <View style={styles.swipeableWrapper}>
        <SwipeableItem
          onPress={onPress}
          onEdit={onEdit}
          onDelete={onDelete}
          onConsume={onConsume}
          onWaste={onWaste}
          onRestock={onRestock}
          onSwipeableWillOpen={onSwipeableWillOpen}
          leftThreshold={80}
          rightThreshold={80}
        >
          {cardContent}
        </SwipeableItem>
      </View>
    );
  }

  // No swipe actions - render as pressable card
  return (
    <View style={styles.swipeableWrapper}>
      <SwipeableItem onPress={onPress}>{cardContent}</SwipeableItem>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  swipeableWrapper: {
    marginBottom: 8,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  imageContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
    overflow: 'hidden',
  },
  emojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 22,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: theme.fonts.weight.semibold,
    color: '#1F2937',
    marginBottom: 2,
  },
  expiration: {
    fontSize: 13,
  },
  expirationBold: {
    fontWeight: theme.fonts.weight.medium,
  },
  meta: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  quantity: {
    fontSize: 15,
    fontWeight: theme.fonts.weight.semibold,
    color: '#374151',
  },
  location: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'capitalize',
    marginTop: 2,
  },
}));
