import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { GetHomesDocument } from '#operations/home/home.generated';
import { useLazyHomeData } from '../useLazyHomeData';

const homesMock = () =>
  recordMock(GetHomesDocument, {
    data: {
      homes: {
        __typename: 'HomeConnection',
        edges: [
          {
            __typename: 'HomeEdge',
            node: { __typename: 'Home', id: 'home-1', name: 'Flat' },
          },
        ],
      },
    },
  });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLazyHomeData', () => {
  it('asks for nothing until the homes are requested', async () => {
    const homes = homesMock();
    const { result } = renderHookWithApollo(() => useLazyHomeData(), {
      operationMocks: [homes.mock],
    });

    await drainTimers();
    expect(homes.fired).toHaveLength(0);
    expect(result.current.isLoaded).toBe(false);
  });

  it('loads the homes once requested and keeps watching them', async () => {
    const homes = homesMock();
    const { result } = renderHookWithApollo(() => useLazyHomeData(), {
      operationMocks: [homes.mock],
    });

    act(() => result.current.fetchHomeData());

    await drainTimers();
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.homes.map(home => home.id)).toEqual(['home-1']);
    expect(homes.fired).toHaveLength(1);
  });
});
