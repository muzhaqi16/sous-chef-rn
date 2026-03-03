import { renderHook, act } from '@testing-library/react-native';
import { useUnitConverter } from '../useUnitConverter';

const mockConvertQuantityQuery = jest.fn();
const mockCanConvertQuery = jest.fn();
const mockParseQuantityQuery = jest.fn();
const mockSuggestDisplayFormatQuery = jest.fn();
const mockGetItemConversionsQuery = jest.fn();
const mockUpsertConversion = jest.fn();

jest.mock('#/graphql/generated', () => ({
  useConvertQuantityLazyQuery: jest.fn(() => [mockConvertQuantityQuery]),
  useCanConvertLazyQuery: jest.fn(() => [mockCanConvertQuery]),
  useParseQuantityInputLazyQuery: jest.fn(() => [mockParseQuantityQuery]),
  useSuggestDisplayFormatLazyQuery: jest.fn(() => [mockSuggestDisplayFormatQuery]),
  useGetItemConversionsLazyQuery: jest.fn(() => [mockGetItemConversionsQuery]),
  useUpsertItemUnitConversionMutation: jest.fn(() => [mockUpsertConversion]),
  DisplayFormat: { Decimal: 'DECIMAL', Fraction: 'FRACTION' },
}));

jest.mock('#/utils/compilerSafeWrappers');

// Break circular dependency
jest.mock('../../apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useUnitConverter', () => {
  it('starts with loading false and no error', () => {
    const { result } = renderHook(() => useUnitConverter());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  describe('convertQuantity', () => {
    it('returns conversion result on success', async () => {
      mockConvertQuantityQuery.mockResolvedValueOnce({
        data: {
          convertQuantity: {
            value: 453.6,
            displayText: '453.6 g',
            unit: { id: 'g', name: 'gram', symbol: 'g' },
          },
        },
      });

      const { result } = renderHook(() => useUnitConverter());

      let conversionResult: any;
      await act(async () => {
        conversionResult = await result.current.convertQuantity({
          quantity: 1,
          fromUnitId: 'lb',
          toUnitId: 'g',
        });
      });

      expect(conversionResult).toEqual({
        value: 453.6,
        displayText: '453.6 g',
        unit: { id: 'g', name: 'gram', symbol: 'g' },
      });
      expect(result.current.loading).toBe(false);
    });

    it('returns null when no data', async () => {
      mockConvertQuantityQuery.mockResolvedValueOnce({ data: {} });

      const { result } = renderHook(() => useUnitConverter());

      let conversionResult: any;
      await act(async () => {
        conversionResult = await result.current.convertQuantity({
          quantity: 1,
          fromUnitId: 'lb',
          toUnitId: 'g',
        });
      });

      expect(conversionResult).toBeNull();
    });
  });

  describe('canConvert', () => {
    it('returns availability info', async () => {
      mockCanConvertQuery.mockResolvedValueOnce({
        data: {
          canConvert: {
            available: true,
            confidence: 0.95,
            requiresItemContext: false,
            conversionType: 'STANDARD',
            notes: null,
          },
        },
      });

      const { result } = renderHook(() => useUnitConverter());

      let availability: any;
      await act(async () => {
        availability = await result.current.canConvert({
          fromUnitId: 'cup',
          toUnitId: 'ml',
        });
      });

      expect(availability).toEqual({
        available: true,
        confidence: 0.95,
        requiresItemContext: false,
        conversionType: 'STANDARD',
        notes: null,
      });
    });
  });

  describe('parseQuantityInput', () => {
    it('parses fractional input', async () => {
      mockParseQuantityQuery.mockResolvedValueOnce({
        data: {
          parseQuantityInput: {
            decimal: 0.5,
            fraction: '1/2',
            mixed: null,
            display: '1/2',
          },
        },
      });

      const { result } = renderHook(() => useUnitConverter());

      let parsed: any;
      await act(async () => {
        parsed = await result.current.parseQuantityInput({
          input: '1/2',
          unitId: 'cup',
        });
      });

      expect(parsed).toEqual({
        decimal: 0.5,
        fraction: '1/2',
        mixed: null,
        display: '1/2',
      });
    });
  });

  describe('getItemConversions', () => {
    it('returns conversions for an item', async () => {
      const mockConversions = [
        { id: 'c1', fromUnit: 'cup', toUnit: 'g', ratio: 120 },
      ];
      mockGetItemConversionsQuery.mockResolvedValueOnce({
        data: { itemConversions: mockConversions },
      });

      const { result } = renderHook(() => useUnitConverter());

      let conversions: any;
      await act(async () => {
        conversions = await result.current.getItemConversions({
          itemId: 'item-1',
        });
      });

      expect(conversions).toEqual(mockConversions);
    });
  });

  describe('addCustomConversion', () => {
    it('calls upsert mutation', async () => {
      mockUpsertConversion.mockResolvedValueOnce({
        data: { upsertItemUnitConversion: { id: 'conv-1' } },
      });

      const { result } = renderHook(() => useUnitConverter());

      let added: any;
      await act(async () => {
        added = await result.current.addCustomConversion({
          itemId: 'item-1',
          fromUnitId: 'cup',
          toUnitId: 'g',
          conversionRatio: 120,
        });
      });

      expect(added).toEqual({ id: 'conv-1' });
    });
  });
});
