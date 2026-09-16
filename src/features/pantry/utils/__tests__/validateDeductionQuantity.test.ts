import { alertService } from '#/services/alertService';
import type { PantryActionSharedState } from '#features/pantry/components/modals/PantryActionModal';
import { validateDeductionQuantity } from '../validateDeductionQuantity';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const shared = (trackingQuantity: number): PantryActionSharedState => ({
  selectedUnitInfo: null,
  setSelectedUnitInfo: jest.fn(),
  notes: '',
  setNotes: jest.fn(),
  trackingQuantity,
  trackingUnitSymbol: 'cup',
  trackingUnitId: 'u1',
  activeUnitSymbol: 'cup',
  activeUnitId: 'u1',
  isConvertedUnit: false,
  pantryItemId: 'pi1',
  defaultUnit: null,
  defaultIncrement: null,
  commonFractions: null,
  availableInSelectedUnit: null,
  availableLoading: false,
  remainingNetWeight: null,
  netWeightUnitSymbol: undefined,
  netWeightUnitId: undefined,
  isDualTracked: false,
});

describe('validateDeductionQuantity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('names the available cap as a cooking fraction', () => {
    expect(validateDeductionQuantity('2', shared(1.25), 'consume')).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('1 1/4 cup'),
    );
  });

  it('rounds an available quantity no fraction fits to three decimals', () => {
    expect(
      validateDeductionQuantity('200', shared(177.4412), 'waste'),
    ).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      'Cannot waste more than available quantity (177.441 cup)',
    );
  });

  it('reads a value that equals the whole stock to three places as the whole stock', () => {
    expect(validateDeductionQuantity('2.457', shared(2.4566), 'waste')).toBe(
      2.4566,
    );
    expect(validateDeductionQuantity('1/3', shared(0.3338), 'waste')).toBe(
      0.3338,
    );
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('reads a value that displays as the whole stock as the whole stock', () => {
    expect(validateDeductionQuantity('1 1/3', shared(1.32), 'consume')).toBe(
      1.32,
    );
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('reads the whole-stock seed as the whole stock where the display rounds the stock differently', () => {
    // 0.2695 displays as "1/4" but seeds as "0.27".
    expect(validateDeductionQuantity('0.27', shared(0.2695), 'waste')).toBe(
      0.2695,
    );
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('refuses a value past the stock at the third decimal', () => {
    expect(
      validateDeductionQuantity('2.46', shared(2.456), 'waste'),
    ).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      'Cannot waste more than available quantity (2.456 cup)',
    );
  });
});
