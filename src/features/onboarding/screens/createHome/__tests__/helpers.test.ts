'use no memo';

import { alertService } from '#/services/alertService';
import { createPantryForHome, showPantryCreationError } from '../helpers';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('helpers', () => {
  describe('createPantryForHome', () => {
    it('selects the id the create minted and returns true', async () => {
      const mockCreatePantry = jest.fn().mockResolvedValue({
        status: 'ok',
        rejectionMessage: null,
        result: {},
        id: 'pantry-1',
      });
      const mockSetPantryId = jest.fn();

      const result = await createPantryForHome(
        'home-1',
        'Kitchen',
        mockCreatePantry,
        mockSetPantryId,
      );

      expect(result).toBe(true);
      expect(mockSetPantryId).toHaveBeenCalledWith('pantry-1');
      // The public hook takes the input directly; it owns the variables shape.
      expect(mockCreatePantry).toHaveBeenCalledWith(
        expect.objectContaining({
          homeId: 'home-1',
          name: 'Kitchen',
          isDefault: true,
        }),
      );
    });

    // The create is local-first: queued, it resolves with no payload at all,
    // and the minted id is still the pantry's id.
    it('succeeds on a queued create, which carries no payload', async () => {
      const mockSetPantryId = jest.fn();
      const result = await createPantryForHome(
        'home-1',
        'Kitchen',
        jest.fn().mockResolvedValue({
          status: 'ok',
          rejectionMessage: null,
          result: { data: { createPantry: null } },
          id: 'pantry-2',
        }),
        mockSetPantryId,
      );

      expect(result).toBe(true);
      expect(mockSetPantryId).toHaveBeenCalledWith('pantry-2');
    });

    it('returns false when the create is refused', async () => {
      const mockSetPantryId = jest.fn();
      const result = await createPantryForHome(
        'home-1',
        'Kitchen',
        jest.fn().mockResolvedValue({
          status: 'rejected',
          rejectionMessage: 'nope',
          result: {},
          id: 'pantry-3',
        }),
        mockSetPantryId,
      );

      expect(result).toBe(false);
      expect(mockSetPantryId).not.toHaveBeenCalled();
    });

    it('returns false on error', async () => {
      const mockCreatePantry = jest
        .fn()
        .mockRejectedValue(new Error('Network error'));

      const result = await createPantryForHome(
        'home-1',
        'Kitchen',
        mockCreatePantry,
        jest.fn(),
      );

      expect(result).toBe(false);
    });
  });

  describe('showPantryCreationError', () => {
    it('shows alert with continue button', () => {
      const onContinue = jest.fn();
      showPantryCreationError(onContinue);

      expect(alertService.alert).toHaveBeenCalledWith(
        'Notice',
        'Pantry creation failed but you can create it later from settings.',
        [{ text: 'Continue', onPress: onContinue }],
      );
    });
  });
});
