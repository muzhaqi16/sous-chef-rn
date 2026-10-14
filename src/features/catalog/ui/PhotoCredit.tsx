import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Link } from '#components/atoms/Link';
import { Text } from '#components/atoms/Text';
import type { ImageCredit } from '#/graphql/generated/schemaTypes';
import { catalogTestIDs } from '#features/catalog/testIDs';

export type PhotoCreditValue = Pick<
  ImageCredit,
  'text' | 'license' | 'licenseUrl' | 'sourceUrl'
>;

interface PhotoCreditProps {
  credit: PhotoCreditValue;
  /** Laid over the photo: light text on a scrim pill. */
  overPhoto?: boolean;
}

/**
 * The attribution a licensed photo needs wherever it is shown full-size, such
 * as an Open Food Facts photo's CC BY-SA: the credit links to the photo's page
 * and the licence to its text.
 */
export const PhotoCredit: React.FC<PhotoCreditProps> = ({
  credit,
  overPhoto = false,
}) => {
  const { t } = useTranslation();
  styles.useVariants({ overPhoto });

  return (
    <View style={styles.row}>
      <Link
        variant="caption"
        href={credit.sourceUrl}
        style={styles.onPhoto}
        testID={catalogTestIDs.photoCreditSource}
      >
        {t('itemPhotos.credit', { source: credit.text })}
      </Link>
      <Text role="caption" tone="secondary" style={styles.onPhoto}>
        ·
      </Text>
      <Link
        variant="caption"
        href={credit.licenseUrl}
        style={styles.onPhoto}
        testID={catalogTestIDs.photoCreditLicense}
      >
        {credit.license}
      </Link>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.xs,
    variants: {
      overPhoto: {
        true: {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing['2xs'],
          borderRadius: theme.radii.full,
          borderCurve: 'continuous',
          backgroundColor: theme.colors.overlays.medium,
        },
      },
    },
  },
  onPhoto: {
    variants: {
      overPhoto: {
        true: {
          color: theme.colors.onScrim,
        },
      },
    },
  },
}));
