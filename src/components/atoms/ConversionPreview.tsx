import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, ActivityIndicator } from 'react-native';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

const ThemedActivityIndicator = withUnistyles(ActivityIndicator, theme => ({
  color: theme.colors.textSecondary,
}));

interface ConversionPreviewProps {
  previewText: string | null;
  loading: boolean;
  confidence: number | null;
}

export const ConversionPreview: React.FC<ConversionPreviewProps> = ({
  previewText,
  loading,
  confidence,
}) => {
  const { t } = useTranslation();

  if (!previewText && !loading) return null;

  const isApproximate = confidence != null && confidence < 0.8;

  return (
    <View style={styles.container}>
      {loading ? (
        <ThemedActivityIndicator size="small" />
      ) : (
        <Text size="sm" tone="secondary" style={styles.text}>
          {previewText}
          {isApproximate ? (
            <Text size="xs" tone="warning">
              {' '}
              {t('conversionPreview.approximate')}
            </Text>
          ) : null}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  text: {
    fontStyle: 'italic',
  },
});
