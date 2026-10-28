import { useFragment, useQuery } from '@apollo/client/react';
import { useTranslation, type TranslationKey } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import { formatCountryName } from '#/utils/formatters/region';
import {
  ProductOriginDocument,
  UseProductOrigin_ItemFragmentDoc,
} from './useProductOrigin.generated';

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
    // Recipe, lookup and collected-price sources state no origin or owner,
    // and the wire can carry a source this build predates.
    case ExternalSource.Aldi:
    case ExternalSource.Allrecipes:
    case ExternalSource.BarcodeLookup:
    case ExternalSource.Edamam:
    case ExternalSource.GiantEagle:
    case ExternalSource.Spoonacular:
    case ExternalSource.Tasty:
    case ExternalSource.UserCreated:
    default:
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
  // The scan's lookup stores these with the item, so this asks only for an
  // item that came another way.
  useQuery(ProductOriginDocument, {
    variables: { itemId },
    fetchPolicy: 'cache-first',
  });
  const { data, complete } = useFragment({
    fragment: UseProductOrigin_ItemFragmentDoc,
    fragmentName: 'useProductOrigin_item',
    from: { __typename: 'Item', id: itemId },
  });
  const item = complete ? data : undefined;

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
