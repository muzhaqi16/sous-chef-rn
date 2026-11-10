import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { storeApi } from '#store';
import { ListCostToGoDocument } from '../useListCostToGo.generated';
import { useLiveCostToGo } from '../useListCostToGo';

const costRead = () =>
  recordMock(ListCostToGoDocument, {
    data: {
      shoppingList: {
        id: 'list-1',
        costToGo: {
          amount: 12.5,
          currency: 'USD',
          pricedLines: 2,
          lines: 3,
        },
      },
    },
  });

const render = (read: ReturnType<typeof costRead>, linesKey: string) =>
  renderHookWithApollo((key: string) => useLiveCostToGo('list-1', key), {
    operationMocks: [read.mock],
    initialProps: linesKey,
  });

beforeEach(() => {
  jest.useFakeTimers();
  storeApi.setState({ isOnline: true, apiReachable: null });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLiveCostToGo', () => {
  it('reads the cost to go once when it mounts', async () => {
    const read = costRead();
    const { result } = render(read, 'a:1:1');
    await drainTimers();

    expect(read.fired).toHaveLength(1);
    expect(result.current).toMatchObject({ amount: 12.5, lines: 3 });
  });

  it('asks again once for a run of check-offs', async () => {
    const read = costRead();
    const { rerender } = render(read, 'a:1:1,b:1:1,c:1:1');
    await drainTimers();

    rerender('b:1:1,c:1:1');
    rerender('c:1:1');
    rerender('');
    await drainTimers();

    expect(read.fired).toHaveLength(2);
  });

  it('does not ask again for the lines it first loads', async () => {
    const read = costRead();
    const { rerender } = render(read, '');
    await drainTimers();

    rerender('a:1:1,b:1:1');
    await drainTimers();

    expect(read.fired).toHaveLength(1);
  });

  it('asks nothing for a check-off made offline', async () => {
    const read = costRead();
    const { rerender } = render(read, 'a:1:1,b:1:1');
    await drainTimers();

    storeApi.setState({ isOnline: false, apiReachable: null });
    rerender('b:1:1');
    await drainTimers();
    storeApi.setState({ isOnline: true, apiReachable: null });
    rerender('b:1:1');
    await drainTimers();

    expect(read.fired).toHaveLength(1);
  });
});
