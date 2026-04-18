import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';

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
  const { theme } = useUnistyles();

  if (!previewText && !loading) return null;

  const isApproximate = confidence != null && confidence < 0.8;

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="small" color={theme.colors.textSecondary} />
      ) : (
        <Text size="sm" tone="secondary" style={styles.text}>
          {previewText}
          {isApproximate ? (
            <Text size="xs" tone="warning">
              {' '}
              (approx.)
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
