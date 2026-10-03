import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useTranslation } from '#/i18n';
import { Pressable } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import type { ImageCredit } from '#/graphql/generated/schemaTypes';
import { openWebUrl } from '#utils/externalUrl';
import { hitSlop } from '#/theme/foundations/sizes';
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
  const tone = overPhoto ? undefined : 'secondary';

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          void openWebUrl(credit.sourceUrl);
        }}
        hitSlop={hitSlop.sm}
        accessibilityRole="link"
        testID={catalogTestIDs.photoCreditSource}
      >
        <Text role="caption" tone={tone} style={styles.link}>
          {t('itemPhotos.credit', { source: credit.text })}
        </Text>
      </Pressable>
      <Text role="caption" tone={tone} style={styles.separator}>
        ·
      </Text>
      <Pressable
        onPress={() => {
          void openWebUrl(credit.licenseUrl);
        }}
        hitSlop={hitSlop.sm}
        accessibilityRole="link"
        testID={catalogTestIDs.photoCreditLicense}
      >
        <Text role="caption" tone={tone} style={styles.link}>
          {credit.license}
        </Text>
      </Pressable>
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
  link: {
    textDecorationLine: 'underline',
    variants: {
      overPhoto: {
        true: {
          color: theme.colors.onScrim,
        },
      },
    },
  },
  separator: {
    variants: {
      overPhoto: {
        true: {
          color: theme.colors.onScrim,
        },
      },
    },
  },
}));
