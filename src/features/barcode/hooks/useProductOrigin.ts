import { useQuery } from '@apollo/client/react';
import { useTranslation, type TranslationKey } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import { formatCountryName } from '#/utils/formatters/region';
import { ProductOriginDocument } from './useProductOrigin.generated';

/** One fact about where a product comes from, and the source that states it. */
export interface OriginLine {
  key: string;
  text: string;
  source: string | null;
}

interface OriginFact {
  countryCode: string;
  source: ExternalSource;
}

function sourceName(source: ExternalSource, t: Translate): string | null {
  switch (source) {
    case ExternalSource.Openfoodfacts:
      return t('labels.sources.openFoodFacts');
    case ExternalSource.Usda:
      return t('labels.sources.usdaFoodDataCentral');
    case ExternalSource.Kroger:
      return t('barcode.origin.source.kroger');
    // Recipe and lookup sources state no origin or owner.
    case ExternalSource.Allrecipes:
    case ExternalSource.BarcodeLookup:
    case ExternalSource.Edamam:
    case ExternalSource.Spoonacular:
    case ExternalSource.Tasty:
    case ExternalSource.UserCreated:
      return null;
  }
}

/**
 * The origin facts a scanned product's records state, and its brand's owner
 * chain as far as they name it. Nothing comes from the barcode or from where
 * the product is sold: with no fact, there are no lines.
 */
export function useProductOrigin(
  itemId: string,
  brandParentName: string | undefined,
) {
  const { t } = useTranslation();
  const { data } = useQuery(ProductOriginDocument, {
    variables: { itemId },
  });
  const item = data?.item;

  const sources = (facts: OriginFact[]) => {
    const names = facts.flatMap(fact => sourceName(fact.source, t) ?? []);
    return names.length > 0 ? [...new Set(names)].join(', ') : null;
  };
  const place = (key: TranslationKey, facts: OriginFact[]): OriginLine[] =>
    facts.length === 0
      ? []
      : [
          {
            key,
            text: t(key, {
              countries: facts
                .map(fact => formatCountryName(fact.countryCode, t))
                .join(', '),
            }),
            source: sources(facts),
          },
        ];

  const origin = item?.origin;
  const lines: OriginLine[] = origin
    ? [
        ...place('barcode.origin.madeIn', origin.madeIn),
        ...place('barcode.origin.ingredientsFrom', origin.ingredientsFrom),
        ...place('barcode.origin.countryOfOrigin', origin.countryOfOrigin),
      ]
    : [];

  const owner = item?.brandOwner;
  const parent = brandParentName === owner?.name ? undefined : brandParentName;
  if (owner) {
    lines.push({
      key: 'owner',
      text: parent
        ? t('barcode.origin.ownedByPartOf', { owner: owner.name, parent })
        : t('barcode.origin.ownedBy', { owner: owner.name }),
      source: sourceName(owner.source, t),
    });
  } else if (parent) {
    lines.push({
      key: 'owner',
      text: t('barcode.origin.partOf', { parent }),
      source: null,
    });
  }

  return { lines };
}
