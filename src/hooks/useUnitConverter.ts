import {useCallback, useState} from 'react';
import {
  useConvertQuantityLazyQuery,
  useCanConvertLazyQuery,
  useParseQuantityInputLazyQuery,
  useSuggestDisplayFormatLazyQuery,
  useGetItemConversionsLazyQuery,
  useUpsertItemUnitConversionMutation,
  DisplayFormat,
} from '#/graphql/generated';

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
export const useUnitConverter = () => {
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
  const convertQuantity = useCallback(
    async (params: {
      quantity: number;
      fromUnitId: string;
      toUnitId: string;
      itemId?: string;
    }): Promise<ConversionResult | null> => {
      setLoading(true);
      setError(null);

      try {
        const {data} = await convertQuantityQuery({
          variables: params,
        });

        if (data?.convertQuantity) {
          return {
            value: data.convertQuantity.value,
            displayText: data.convertQuantity.displayText,
            unit: {
              id: data.convertQuantity.unit.id,
              name: data.convertQuantity.unit.name,
              symbol: data.convertQuantity.unit.symbol,
            },
          };
        }

        return null;
      } catch (err: any) {
        setError(err.message || 'Failed to convert quantity');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [convertQuantityQuery]
  );

  /**
   * Check if conversion is possible between units
   */
  const canConvert = useCallback(
    async (params: {
      fromUnitId: string;
      toUnitId: string;
      itemId?: string;
    }): Promise<ConversionAvailability | null> => {
      setLoading(true);
      setError(null);

      try {
        const {data} = await canConvertQuery({
          variables: params,
        });

        if (data?.canConvert) {
          return {
            available: data.canConvert.available,
            confidence: data.canConvert.confidence,
            requiresItemContext: data.canConvert.requiresItemContext,
            conversionType: data.canConvert.conversionType,
            notes: data.canConvert.notes,
          };
        }

        return null;
      } catch (err: any) {
        setError(err.message || 'Failed to check conversion availability');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [canConvertQuery]
  );

  /**
   * Parse fractional input string to decimal
   */
  const parseQuantityInput = useCallback(
    async (params: {
      input: string;
      unitId: string;
    }): Promise<QuantityParsed | null> => {
      setLoading(true);
      setError(null);

      try {
        const {data} = await parseQuantityQuery({
          variables: params,
        });

        if (data?.parseQuantityInput) {
          return {
            decimal: data.parseQuantityInput.decimal,
            fraction: data.parseQuantityInput.fraction,
            mixed: data.parseQuantityInput.mixed,
            display: data.parseQuantityInput.display,
          };
        }

        return null;
      } catch (err: any) {
        setError(err.message || 'Failed to parse quantity input');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [parseQuantityQuery]
  );

  /**
   * Get suggested display format for a quantity
   */
  const suggestDisplayFormat = useCallback(
    async (params: {
      quantity: number;
      unitId: string;
      userId?: string;
    }): Promise<DisplayFormat | null> => {
      try {
        const {data} = await suggestDisplayFormatQuery({
          variables: params,
        });

        return data?.suggestDisplayFormat?.display as DisplayFormat || null;
      } catch (err: any) {
        console.error('Failed to suggest display format:', err);
        return null;
      }
    },
    [suggestDisplayFormatQuery]
  );

  /**
   * Get all available conversions for an item
   */
  const getItemConversions = useCallback(
    async (params: {
      itemId: string;
      includeStandard?: boolean;
    }) => {
      setLoading(true);
      setError(null);

      try {
        const {data} = await getItemConversionsQuery({
          variables: params,
        });

        return data?.itemConversions || [];
      } catch (err: any) {
        setError(err.message || 'Failed to get item conversions');
        return [];
      } finally {
        setLoading(false);
      }
    },
    [getItemConversionsQuery]
  );

  /**
   * Add or update a custom conversion
   */
  const addCustomConversion = useCallback(
    async (params: {
      itemId: string;
      fromUnitId: string;
      toUnitId: string;
      conversionRatio: number;
      notes?: string;
    }) => {
      setLoading(true);
      setError(null);

      try {
        const {data} = await upsertConversion({
          variables: { input: params },
        });

        return data?.upsertItemUnitConversion || null;
      } catch (err: any) {
        setError(err.message || 'Failed to add custom conversion');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [upsertConversion]
  );

  return {
    convertQuantity,
    canConvert,
    parseQuantityInput,
    suggestDisplayFormat,
    getItemConversions,
    addCustomConversion,
    loading,
    error,
  };
};
