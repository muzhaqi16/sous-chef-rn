import React from 'react';
import { useTranslation } from '#/i18n';
import { View, StyleProp, ViewStyle, ActivityIndicator } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SousChefLoader } from '#components/atoms/SousChefLoader';
import { Text } from '#components/atoms/Text';
import { ThemedActivityIndicator } from '#components/atoms/themedComponents';

export interface LoadingProps {
  /** Primary loading message. The brand spinner draws it in its own banner. */
  message?: string;

  /** Secondary line under the spinner (a barcode, an id). */
  submessage?: string;

  /** Size of the activity indicator. Ignored by the brand spinner. */
  size?: 'small' | 'large';

  /** Which spinner draws: the themed indicator, or the brand illustration. */
  spinner?: 'indicator' | 'brand';

  /** Custom color for the indicator. */
  color?: string;

  /** Additional container styles. */
  style?: StyleProp<ViewStyle>;

  testID?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  message,
  submessage,
  size = 'large',
  spinner: spinnerKind = 'indicator',
  color,
  style,
  testID,
}) => {
  const { t } = useTranslation();
  const brand = spinnerKind === 'brand';

  return (
    <View style={[styles.container, style]} testID={testID}>
      {brand ? (
        <SousChefLoader
          size="small"
          showBrand={false}
          message={message || t('labels.loading')}
        />
      ) : color != null ? (
        <ActivityIndicator size={size} color={color} style={styles.spinner} />
      ) : (
        <ThemedActivityIndicator size={size} style={styles.spinner} />
      )}
      {/* The brand spinner already draws the message in its banner. */}
      {!brand && !!message && (
        <Text
          role="bodyStrong"
          align="center"
          tone="primary"
          style={styles.message}
        >
          {message}
        </Text>
      )}
      {!!submessage && (
        <Text
          role="caption"
          align="center"
          tone="secondary"
          style={styles.submessage}
        >
          {submessage}
        </Text>
      )}
    </View>
  );
};

/** The brand loader, for a spot that already has its own chrome. */
export const LoadingBranded: React.FC<
  Pick<LoadingProps, 'message' | 'submessage' | 'style' | 'testID'>
> = props => <Loading spinner="brand" {...props} />;

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },

  spinner: {
    marginBottom: theme.spacing.md,
  },

  message: {
    marginBottom: theme.spacing.xs,
  },

  submessage: {
    fontFamily: 'monospace',
  },
}));

export default Loading;
