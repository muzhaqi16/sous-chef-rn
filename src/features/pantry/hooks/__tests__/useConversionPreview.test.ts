import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
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

    await act(async () => {
      rerender({ inputQuantity: 1.25 });
    });

    expect(result.current.previewText).toBe('1 1/4 cup ≈ 177.441 g');
  });
});
