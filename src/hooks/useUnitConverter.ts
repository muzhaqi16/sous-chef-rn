import {useState} from 'react';
import {
  useConvertQuantityLazyQuery,
  useCanConvertLazyQuery,
  useParseQuantityInputLazyQuery,
  useSuggestDisplayFormatLazyQuery,
  useGetItemConversionsLazyQuery,
  useUpsertItemUnitConversionMutation,
  DisplayFormat } from '#/graphql/generated';
import { executeQuery } from '#/utils/compilerSafeWrappers';

/**
 * Module-level try-catch wrapper for converter operations with loading/error state.
 * Keeps try-catch out of the hook body for React Compiler compatibility.
 */
async function executeConverterOperation<T>(
  operationFn: () => Promise<T>,
  onError: (message: string) => void,
  fallback: T,
): Promise<T> {
  try {
    return await operationFn();
  } catch (err: any) {
    onError(err.message || 'Operation failed');
    return fallback;
  }
}

export interface ConversionResult {
  value: number;
  displayText: string;
  unit: {
    id: string;
    name: string;
    symbol: string;
  };
}

export interface ConversionAvailability {
  available: boolean;
  confidence: number;
  requiresItemContext: boolean;
  conversionType: string;
  notes?: string | null;
}

export interface QuantityParsed {
  decimal: number;
  fraction?: string | null;
  mixed?: string | null;
  display: string;
}

/**
 * Hook for unit conversion operations
 *
 * Provides methods for:
 * - Converting quantities between units
 * - Checking conversion availability
 * - Parsing fractional input
 * - Suggesting display formats
 * - Managing custom conversions
 */
export function useUnitConverter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query hooks
  const [convertQuantityQuery] = useConvertQuantityLazyQuery();
  const [canConvertQuery] = useCanConvertLazyQuery();
  const [parseQuantityQuery] = useParseQuantityInputLazyQuery();
  const [suggestDisplayFormatQuery] = useSuggestDisplayFormatLazyQuery();
  const [getItemConversionsQuery] = useGetItemConversionsLazyQuery();

  // Mutation hooks
  const [upsertConversion] = useUpsertItemUnitConversionMutation();

  /**
   * Convert quantity from one unit to another
   */
  const convertQuantity = async (params: {
      quantity: number;
      fromUnitId: string;
      toUnitId: string;
      itemId?: string;
    }): Promise<ConversionResult | null> => {
      setLoading(true);
      setError(null);

      const result = await executeConverterOperation(async () => {
        const {data} = await convertQuantityQuery({
          variables: params });

        if (data?.convertQuantity) {
          return {
            value: data.convertQuantity.value,
            displayText: data.convertQuantity.displayText,
            unit: {
              id: data.convertQuantity.unit.id,
              name: data.convertQuantity.unit.name,
              symbol: data.convertQuantity.unit.symbol } };
        }

        return null;
      }, (msg) => setError(msg || 'Failed to convert quantity'), null);

      setLoading(false);
      return result;
    };

  /**
   * Check if conversion is possible between units
   */
  const canConvert = async (params: {
      fromUnitId: string;
      toUnitId: string;
      itemId?: string;
    }): Promise<ConversionAvailability | null> => {
      setLoading(true);
      setError(null);

      const result = await executeConverterOperation(async () => {
        const {data} = await canConvertQuery({
          variables: params });

        if (data?.canConvert) {
          return {
            available: data.canConvert.available,
            confidence: data.canConvert.confidence,
            requiresItemContext: data.canConvert.requiresItemContext,
            conversionType: data.canConvert.conversionType,
            notes: data.canConvert.notes };
        }

        return null;
      }, (msg) => setError(msg || 'Failed to check conversion availability'), null);

      setLoading(false);
      return result;
    };

  /**
   * Parse fractional input string to decimal
   */
  const parseQuantityInput = async (params: {
      input: string;
      unitId: string;
    }): Promise<QuantityParsed | null> => {
      setLoading(true);
      setError(null);

      const result = await executeConverterOperation(async () => {
        const {data} = await parseQuantityQuery({
          variables: params });

        if (data?.parseQuantityInput) {
          return {
            decimal: data.parseQuantityInput.decimal,
            fraction: data.parseQuantityInput.fraction,
            mixed: data.parseQuantityInput.mixed,
            display: data.parseQuantityInput.display };
        }

        return null;
      }, (msg) => setError(msg || 'Failed to parse quantity input'), null);

      setLoading(false);
      return result;
    };

  /**
   * Get suggested display format for a quantity
   */
  const suggestDisplayFormat = async (params: {
      quantity: number;
      unitId: string;
      userId?: string;
    }): Promise<DisplayFormat | null> => {
      const result = await executeQuery(async () => {
        const {data} = await suggestDisplayFormatQuery({
          variables: params });

        return data?.suggestDisplayFormat?.display as DisplayFormat || null;
      }, 'Failed to suggest display format');

      return result;
    };

  /**
   * Get all available conversions for an item
   */
  const getItemConversions = async (params: {
      itemId: string;
      includeStandard?: boolean;
    }) => {
      setLoading(true);
      setError(null);

      const result = await executeConverterOperation(async () => {
        const {data} = await getItemConversionsQuery({
          variables: params });

        return data?.itemConversions || [];
      }, (msg) => setError(msg || 'Failed to get item conversions'), [] as any[]);

      setLoading(false);
      return result;
    };

  /**
   * Add or update a custom conversion
   */
  const addCustomConversion = async (params: {
      itemId: string;
      fromUnitId: string;
      toUnitId: string;
      conversionRatio: number;
      notes?: string;
    }) => {
      setLoading(true);
      setError(null);

      const result = await executeConverterOperation(async () => {
        const {data} = await upsertConversion({
          variables: { input: params } });

        return data?.upsertItemUnitConversion || null;
      }, (msg) => setError(msg || 'Failed to add custom conversion'), null);

      setLoading(false);
      return result;
    };

  return {
    convertQuantity,
    canConvert,
    parseQuantityInput,
    suggestDisplayFormat,
    getItemConversions,
    addCustomConversion,
    loading,
    error };
}
