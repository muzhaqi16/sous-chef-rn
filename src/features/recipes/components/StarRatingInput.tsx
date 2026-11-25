import React from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { IconSizeName } from '#components/atoms/Icon';
import { useTranslation } from '#i18n';

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  size?: IconSizeName;
  disabled?: boolean;
}

export const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  size = 'md',
  disabled = false,
}) => {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map(star => (
        <IconButton
          key={star}
          name={star <= value ? 'star' : 'star-outline'}
          size={size}
          tone={star <= value ? 'rating' : 'textSecondary'}
          onPress={() => onChange(star)}
          accessibilityLabel={t('a11y.rateStars', { count: star })}
          disabled={disabled}
        />
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
}));
