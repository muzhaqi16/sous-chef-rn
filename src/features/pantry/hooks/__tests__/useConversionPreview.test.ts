import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { ConvertQuantityDocument } from '#operations/item/conversions.generated';
import { useConversionPreview } from '../useConversionPreview';

// 1 1/4 cup of this item weighs 177.4412 g.
const CUP_PER_GRAM = 1.25 / 177.4412;
interface Props {
  inputQuantity: number | null;
}

describe('useConversionPreview', () => {
  it('formats both sides of a locally converted preview', async () => {
    const { result, rerender } = renderHookWithApollo<
      ReturnType<typeof useConversionPreview>,
      Props
    >(
      ({ inputQuantity }) =>
        useConversionPreview({
          pantryItemId: 'pi1',
          inputQuantity,
          selectedUnitId: 'cup',
          selectedUnitSymbol: 'cup',
          trackingUnitId: 'g',
          trackingUnitSymbol: 'g',
          conversionRatio: CUP_PER_GRAM,
        }),
      {
        operationMocks: [],
        initialProps: { inputQuantity: null },
      },
    );

    rerender({ inputQuantity: 1.25 });

    expect(result.current.previewText).toBe('1 1/4 cup ≈ 177.441 g');
  });

  it("writes each side in its own unit's notation", () => {
    const { result, rerender } = renderHookWithApollo<
      ReturnType<typeof useConversionPreview>,
      Props
    >(
      ({ inputQuantity }) =>
        useConversionPreview({
          pantryItemId: 'pi1',
          inputQuantity,
          selectedUnitId: 'g',
          selectedUnitSymbol: 'g',
          selectedDisplayAsFraction: false,
          trackingUnitId: 'kg',
          trackingUnitSymbol: 'kg',
          trackingDisplayAsFraction: false,
          conversionRatio: 1000,
        }),
      {
        operationMocks: [],
        initialProps: { inputQuantity: null },
      },
    );

    rerender({ inputQuantity: 250 });

    expect(result.current.previewText).toBe('250 g ≈ 0.25 kg');
  });

  it('asks the server once the input holds still, for the latest amount only', async () => {
    const convert = recordMock(ConvertQuantityDocument, {
      dataFor: vars => ({
        convertQuantity: { value: Number(vars.quantity) * 14.787 },
      }),
    });
    const { result, rerender } = renderHookWithApollo<
      ReturnType<typeof useConversionPreview>,
      Props
    >(
      ({ inputQuantity }) =>
        useConversionPreview({
          pantryItemId: 'pi1',
          inputQuantity,
          selectedUnitId: 'tbsp',
          selectedUnitSymbol: 'tbsp',
          selectedDisplayAsFraction: false,
          trackingUnitId: 'ml',
          trackingUnitSymbol: 'mL',
          trackingDisplayAsFraction: false,
          conversionRatio: null,
        }),
      {
        operationMocks: [convert.mock],
        initialProps: { inputQuantity: null },
      },
    );

    rerender({ inputQuantity: 1 });
    rerender({ inputQuantity: 2 });
    expect(result.current.previewLoading).toBe(true);
    expect(result.current.convertedValue).toBeNull();

    await waitFor(() =>
      expect(result.current.previewText).toBe('2 tbsp ≈ 29.574 mL'),
    );
    expect(result.current.previewLoading).toBe(false);
    expect(convert.fired).toEqual([
      expect.objectContaining({ quantity: 2, fromUnitId: 'tbsp' }),
    ]);
  });
});
