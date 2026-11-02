import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import {
  discardRefusedChange,
  retryRefusedChange,
} from '#/apollo/offlineQueue/refusedChanges';
import { QueueStatus, type QueuedMutation } from '#/apollo/offlineQueue/types';
import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { storage } from '#/store/deviceStorage';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { profileTestIDs } from '#features/profile/testIDs';
import ChangesNotSavedScreen from '../ChangesNotSavedScreen';

jest.mock('#/apollo/offlineQueue/refusedChanges', () => ({
  ...jest.requireActual('#/apollo/offlineQueue/refusedChanges'),
  retryRefusedChange: jest.fn(),
  discardRefusedChange: jest.fn(),
}));
jest.mock('#components/templates/SubScreen', () => ({
  SubScreen: ({ children }: { children?: React.ReactNode }) => children,
}));

const CONFLICT = {
  type: 'conflict',
  message: 'stale',
  code: 'VERSION_CONFLICT',
  timestamp: 0,
  retryable: false,
} as const;

const keep = (overrides: Partial<QueuedMutation> = {}) => {
  queueStore.addMutation(
    makeQueuedMutation({
      id: 'change',
      ...queuedMutationFor(UpdatePantryItemDocument),
      status: QueueStatus.REFUSED,
      lastError: CONFLICT,
      refusedResource: 'PantryItem',
      pendingWrite: {
        id: 'write-1',
        inputs: {
          fields: {
            storageNotes: 'top shelf',
            minQuantity: 2,
            updatedAt: '2026-11-01T10:00:00.000Z',
          },
          baseline: { itemName: 'Milk', storageNotes: 'door' },
        },
      },
      ...overrides,
    }),
  );
};

beforeEach(() => {
  storage.clearAll();
  queueStore.invalidateCache();
  queueStore.setCurrentUserId('user-1');
  jest.clearAllMocks();
});

describe('ChangesNotSavedScreen', () => {
  it('says what each change was and why it was not saved', () => {
    keep();

    render(<ChangesNotSavedScreen />);

    expect(screen.getByText('Milk')).toBeTruthy();
    expect(screen.getByText('top shelf · 2')).toBeTruthy();
    expect(screen.getByText(t('changesNotSaved.reasonConflict'))).toBeTruthy();
  });

  it('names a change that names no row by what it was to', () => {
    keep({ pendingWrite: undefined, variables: {} });

    render(<ChangesNotSavedScreen />);

    expect(screen.getByText(t('errors.resourceNames.PantryItem'))).toBeTruthy();
  });

  it('sends a retry to the queue', () => {
    keep();
    render(<ChangesNotSavedScreen />);

    fireEvent.press(
      screen.getByTestId(profileTestIDs.changeNotSavedRetry('change')),
    );

    expect(retryRefusedChange).toHaveBeenCalledWith('change');
  });

  it('asks before discarding, since nothing brings a change back', () => {
    keep();
    render(<ChangesNotSavedScreen />);

    fireEvent.press(
      screen.getByTestId(profileTestIDs.changeNotSavedDiscard('change')),
    );

    expect(discardRefusedChange).not.toHaveBeenCalled();
    const [[, , buttons]] = (alertService.alert as jest.Mock).mock.calls as [
      [string, string, { style?: string; onPress?(): void }[]],
    ];
    buttons.find(({ style }) => style === 'destructive')?.onPress?.();
    expect(discardRefusedChange).toHaveBeenCalledWith('change');
  });

  it('leaves only discard for a row someone deleted', () => {
    keep({
      lastError: { ...CONFLICT, type: 'unknown', code: 'NotFoundError' },
    });

    render(<ChangesNotSavedScreen />);

    expect(screen.getByText(t('changesNotSaved.reasonGone'))).toBeTruthy();
    expect(
      screen.queryByTestId(profileTestIDs.changeNotSavedRetry('change')),
    ).toBeNull();
    expect(
      screen.getByTestId(profileTestIDs.changeNotSavedDiscard('change')),
    ).toBeTruthy();
  });

  it('follows the queue as a change leaves it', () => {
    keep();
    render(<ChangesNotSavedScreen />);

    act(() => {
      queueStore.discard('change');
    });

    expect(screen.getByText(t('changesNotSaved.emptyTitle'))).toBeTruthy();
  });

  it('holds nothing of another account’s', () => {
    keep({ userId: 'user-2' });

    render(<ChangesNotSavedScreen />);

    expect(screen.queryByText('Milk')).toBeNull();
    expect(screen.getByText(t('changesNotSaved.emptyTitle'))).toBeTruthy();
  });
});
