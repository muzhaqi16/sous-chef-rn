import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { SoonestDatedItemDocument } from '../useSoonestDatedItem.generated';
import { useSoonestDatedItem } from '../useSoonestDatedItem';

const soonest = (name: string | null) =>
  recordMock(SoonestDatedItemDocument, {
    data: {
      pantry: {
        id: 'pantry-1',
        itemsConnection: {
          edges: name
            ? [{ node: { id: 'stack-1', item: { id: 'item-1', name } } }]
            : [],
        },
      },
    },
  });

// Its midnight watcher re-arms, which a drained clock would never finish.
jest.mock('#hooks/app/useToday', () => ({ useToday: () => '2026-11-10' }));

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useSoonestDatedItem', () => {
  // The API refuses `expiringSoon` without the viewer's date, and a refused
  // read names nothing, so the expiry ask would never come.
  it('asks with the viewer’s date and names the food that expires first', async () => {
    const lookup = soonest('Milk');
    const { result } = renderHookWithApollo(
      () => useSoonestDatedItem('pantry-1'),
      { operationMocks: [lookup.mock] },
    );

    await drainTimers();

    expect(result.current).toBe('Milk');
    expect(lookup.fired).toEqual([
      expect.objectContaining({ pantryId: 'pantry-1', today: '2026-11-10' }),
    ]);
  });

  it('names nothing when nothing is dated', async () => {
    const lookup = soonest(null);
    const { result } = renderHookWithApollo(
      () => useSoonestDatedItem('pantry-1'),
      { operationMocks: [lookup.mock] },
    );

    await drainTimers();

    expect(lookup.fired).toHaveLength(1);
    expect(result.current).toBeNull();
  });

  it('asks nothing without a pantry, or while skipped', () => {
    const lookup = soonest('Milk');
    renderHookWithApollo(() => useSoonestDatedItem(undefined), {
      operationMocks: [lookup.mock],
    });
    renderHookWithApollo(
      () => useSoonestDatedItem('pantry-1', { skip: true }),
      { operationMocks: [lookup.mock] },
    );

    expect(lookup.fired).toEqual([]);
  });
});
