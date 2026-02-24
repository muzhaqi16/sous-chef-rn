import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  disabled?: boolean;
}

export const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  size = 28,
  disabled = false,
}) => {
  const { theme } = useUnistyles();

  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map(star => (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          hitSlop={6}
          disabled={disabled}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Ionicons
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            color={
              star <= value
                ? theme.colors.rating
                : theme.colors.textSecondary
            }
          />
        </Pressable>
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
