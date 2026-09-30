import { alertService } from '#/services/alertService';
import {
  eggsShared,
  pantryActionShared as shared,
} from '#/test-utils/pantryActionShared';
import { validateDeductionQuantity } from '../validateDeductionQuantity';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

describe('validateDeductionQuantity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('names the available cap as a cooking fraction', () => {
    expect(validateDeductionQuantity('2', shared(1.25), 'consume')).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('1 1/4 cup'),
    );
  });

  it('names the cap in decimals for a unit not shown as a fraction', () => {
    expect(
      validateDeductionQuantity(
        '1',
        shared(0.25, {
          trackingUnitSymbol: 'kg',
          activeUnitSymbol: 'kg',
          displayAsFractionOf: () => false,
        }),
        'consume',
      ),
    ).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('0.25 kg'),
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

  it('records an amount below the stock as typed, even where both display alike', () => {
    // 0.315 and 0.34 both display as "1/3".
    expect(validateDeductionQuantity('0.315', shared(0.34), 'consume')).toBe(
      0.315,
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

  it('names the cap as the stack shows it when a dozen is more than is left', () => {
    expect(
      validateDeductionQuantity('1', eggsShared(11, 'doz'), 'consume'),
    ).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      'Cannot consume more than available quantity (11 pc)',
    );
  });

  it('names a cap that is a common fraction of a dozen in dozens', () => {
    expect(
      validateDeductionQuantity('3', eggsShared(32, 'doz'), 'waste'),
    ).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      'Cannot waste more than available quantity (2 2/3 doz)',
    );
  });

  it('reads a typed dozen fraction of the whole stock as the whole stock', () => {
    expect(
      validateDeductionQuantity('0.917', eggsShared(11, 'doz'), 'consume'),
    ).toBe(11 / 12);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('checks a dozen amount against the pieces held', () => {
    expect(
      validateDeductionQuantity('3', eggsShared(36, 'doz'), 'consume'),
    ).toBe(3);
    expect(
      validateDeductionQuantity('3 1/12', eggsShared(36, 'doz'), 'consume'),
    ).toBeNull();
    expect(alertService.alert).toHaveBeenCalledWith(
      expect.any(String),
      'Cannot consume more than available quantity (3 doz)',
    );
  });
});
