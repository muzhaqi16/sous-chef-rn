import { waitFor } from '@testing-library/react-native';
import { t } from '#/i18n';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import { formatCountryName } from '#/utils/formatters/region';
import { ProductOriginDocument } from '../useProductOrigin.generated';
import { useProductOrigin } from '../useProductOrigin';

const fact = (countryCode: string, source: ExternalSource) => ({
  countryCode,
  source,
});
const country = (code: string) => formatCountryName(code, t);

const originMock = (item: {
  origin: {
    madeIn: ReturnType<typeof fact>[];
    ingredientsFrom: ReturnType<typeof fact>[];
    countryOfOrigin: ReturnType<typeof fact>[];
  } | null;
  brandOwner: { name: string; source: ExternalSource } | null;
}) =>
  recordMock(ProductOriginDocument, {
    data: { item: { id: 'item-1', ...item } },
  });

const render = (
  mock: ReturnType<typeof recordMock>,
  brandParentName?: string,
) =>
  renderHookWithApollo(() => useProductOrigin('item-1', brandParentName), {
    operationMocks: [mock.mock],
  });

describe('useProductOrigin', () => {
  it('states each fact the records give, with the source that states it', async () => {
    const { result } = render(
      originMock({
        origin: {
          madeIn: [fact('CA', ExternalSource.Openfoodfacts)],
          ingredientsFrom: [],
          countryOfOrigin: [
            fact('MX', ExternalSource.Kroger),
            fact('US', ExternalSource.Kroger),
          ],
        },
        brandOwner: {
          name: 'The J.M. Smucker Co.',
          source: ExternalSource.Usda,
        },
      }),
      'Smucker Holdings',
    );

    await waitFor(() => expect(result.current.lines).toHaveLength(3));
    expect(result.current.lines).toEqual([
      {
        key: 'barcode.origin.madeIn',
        text: t('barcode.origin.madeIn', { countries: country('CA') }),
        source: t('labels.sources.openFoodFacts'),
      },
      {
        key: 'barcode.origin.countryOfOrigin',
        text: t('barcode.origin.countryOfOrigin', {
          countries: `${country('MX')}, ${country('US')}`,
        }),
        source: t('barcode.origin.source.kroger'),
      },
      {
        key: 'owner',
        text: t('barcode.origin.ownedByPartOf', {
          owner: 'The J.M. Smucker Co.',
          parent: 'Smucker Holdings',
        }),
        source: t('labels.sources.usdaFoodDataCentral'),
      },
    ]);
  });

  it('reads the product by its item alone, so a 729 barcode with no stated origin shows nothing', async () => {
    const mock = originMock({ origin: null, brandOwner: null });
    const { result } = render(mock);

    await waitFor(() => expect(mock.fired).toHaveLength(1));
    expect(mock.fired[0]).toEqual({ itemId: 'item-1' });
    expect(result.current.lines).toEqual([]);
  });

  it('names a parent the owner does not repeat, and a parent alone with no source', async () => {
    const sameName = render(
      originMock({
        origin: null,
        brandOwner: { name: 'General Mills', source: ExternalSource.Usda },
      }),
      'General Mills',
    );
    await waitFor(() =>
      expect(sameName.result.current.lines).toEqual([
        {
          key: 'owner',
          text: t('barcode.origin.ownedBy', { owner: 'General Mills' }),
          source: t('labels.sources.usdaFoodDataCentral'),
        },
      ]),
    );

    const parentOnly = render(
      originMock({ origin: null, brandOwner: null }),
      'General Mills',
    );
    await waitFor(() =>
      expect(parentOnly.result.current.lines).toEqual([
        {
          key: 'owner',
          text: t('barcode.origin.partOf', { parent: 'General Mills' }),
          source: null,
        },
      ]),
    );
  });
});
