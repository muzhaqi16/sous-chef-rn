import React from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { useTranslation } from '#/i18n';

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
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map(star => (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          accessibilityLabel={t('a11y.rateStars', { count: star })}
          hitSlop={6}
          disabled={disabled}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Icon
            name={star <= value ? 'star' : 'star-outline'}
            size={size}
            tone={star <= value ? 'rating' : 'textSecondary'}
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
