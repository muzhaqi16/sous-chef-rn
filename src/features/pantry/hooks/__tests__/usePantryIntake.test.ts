import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { usePantryIntake } from '../usePantryIntake';

jest.mock('#/apollo/links/tokenScheduler');

describe('usePantryIntake', () => {
  it('sends the day of the add on the input, for its default expiry', async () => {
    const create = recordMock(CreatePantryItemDocument, {
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: { __typename: 'PantryItem', id: 'pi-new' },
        },
      },
    });
    const { result } = renderHookWithApollo(() => usePantryIntake('p-1'), {
      operationMocks: [create.mock],
    });

    await act(async () => {
      await result.current.addItem('Milk', {
        item: { id: 'cat-milk' },
        quantity: 1,
      });
    });

    const [fired] = create.fired;
    expect(fired?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fired?.input).toMatchObject({ today: fired?.today });
  });
});
