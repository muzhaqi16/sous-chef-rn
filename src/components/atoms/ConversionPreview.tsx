import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

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
        <Text style={styles.text}>
          {previewText}
          {isApproximate ? (
            <Text style={styles.approxLabel}> (approx.)</Text>
          ) : null}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    minHeight: 20,
  },
  text: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  approxLabel: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.warning,
  },
}));
