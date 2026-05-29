'use no memo';

import { alertService } from '#/services/alertService';
import {
  checkExistingResources,
  createPantryForHome,
  showPantryCreationError,
  showSkipPantryWarning,
} from '../helpers';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('helpers', () => {
  describe('checkExistingResources', () => {
    const mockCallbacks = {
      onComplete: jest.fn(),
      onBothExist: jest.fn(),
      setSelectedHomeId: jest.fn(),
      setSelectedPantryId: jest.fn(),
    };

    it('calls onComplete when no homes exist', async () => {
      const result = await checkExistingResources([], [], mockCallbacks);

      expect(result).toBe(false);
      expect(mockCallbacks.onComplete).toHaveBeenCalled();
    });

    it('sets home ID and calls onComplete when home exists but no pantry', async () => {
      const homes = [{ id: 'home-1', name: 'Home' }];
      const result = await checkExistingResources(homes, [], mockCallbacks);

      expect(result).toBe(false);
      expect(mockCallbacks.setSelectedHomeId).toHaveBeenCalledWith('home-1');
      expect(mockCallbacks.onComplete).toHaveBeenCalled();
    });

    it('sets both IDs and calls onBothExist when both exist', async () => {
      const homes = [{ id: 'home-1', name: 'Home' }];
      const pantries = [{ id: 'pantry-1', isDefault: true }];

      const result = await checkExistingResources(
        homes,
        pantries,
        mockCallbacks,
      );

      expect(result).toBe(true);
      expect(mockCallbacks.setSelectedHomeId).toHaveBeenCalledWith('home-1');
      expect(mockCallbacks.setSelectedPantryId).toHaveBeenCalledWith(
        'pantry-1',
      );
      expect(mockCallbacks.onBothExist).toHaveBeenCalled();
    });

    it('uses first pantry when no default pantry', async () => {
      const homes = [{ id: 'home-1' }];
      const pantries = [
        { id: 'pantry-1', isDefault: false },
        { id: 'pantry-2', isDefault: false },
      ];

      await checkExistingResources(homes, pantries, mockCallbacks);

      expect(mockCallbacks.setSelectedPantryId).toHaveBeenCalledWith(
        'pantry-1',
      );
    });

    it('prefers default pantry over first', async () => {
      const homes = [{ id: 'home-1' }];
      const pantries = [
        { id: 'pantry-1', isDefault: false },
        { id: 'pantry-2', isDefault: true },
      ];

      await checkExistingResources(homes, pantries, mockCallbacks);

      expect(mockCallbacks.setSelectedPantryId).toHaveBeenCalledWith(
        'pantry-2',
      );
    });
  });

  describe('createPantryForHome', () => {
    it('creates pantry and returns true on success', async () => {
      const mockCreatePantry = jest.fn().mockResolvedValue({
        data: {
          createPantry: {
            __typename: 'CreatePantryPayload',
            success: true,
            pantry: { id: 'pantry-1', name: 'Kitchen' },
          },
        },
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
      expect(mockCreatePantry).toHaveBeenCalledWith({
        variables: {
          input: expect.objectContaining({
            homeId: 'home-1',
            name: 'Kitchen',
            isDefault: true,
          }),
        },
      });
    });

    it('returns false when mutation fails', async () => {
      const mockCreatePantry = jest.fn().mockResolvedValue({
        data: { createPantry: { success: false, pantry: null } },
      });

      const result = await createPantryForHome(
        'home-1',
        'Kitchen',
        mockCreatePantry,
        jest.fn(),
      );

      expect(result).toBe(false);
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

    it('returns false when pantry is null in response', async () => {
      const mockCreatePantry = jest.fn().mockResolvedValue({
        data: { createPantry: { success: true, pantry: null } },
      });

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

  describe('showSkipPantryWarning', () => {
    it('shows alert with cancel and skip buttons', () => {
      const onSkip = jest.fn();
      showSkipPantryWarning(onSkip);

      expect(alertService.alert).toHaveBeenCalledWith(
        'Skip Pantry Creation?',
        expect.any(String),
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Skip', onPress: onSkip, style: 'destructive' },
        ],
      );
    });
  });
});
