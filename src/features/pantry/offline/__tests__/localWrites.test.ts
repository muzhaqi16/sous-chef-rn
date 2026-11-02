import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { PendingWrites } from '#/apollo/pendingWrites/pendingWrites';
import { readFenceOf } from '#/apollo/pendingWrites/readFence';
import type { PendingWrite } from '#/apollo/pendingWrites/types';
import {
  completeSeed,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { ItemCondition } from '#/graphql/generated/schemaTypes';
import {
  ConvertExpiredToWasteDocument,
  CreatePantryDocument,
  CreatePantryItemDocument,
  CreatePantryItemUsageDocument,
  DeletePantryDocument,
  DeletePantryItemDocument,
  RestockPantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import {
  addStock,
  createItem,
  createPantry,
  discardExpired,
  drawStock,
  removeItem,
  removePantry,
  setStock,
  type AddStockInputs,
  type CreateItemInputs,
  type CreatePantryInputs,
  type DiscardExpiredInputs,
  type DrawStockInputs,
  type RemoveItemInputs,
  type RemovePantryInputs,
  type SetStockInputs,
} from '../localWrites';

const NOW = '2026-10-30T10:00:00.000Z';

const STOCK = gql`
  fragment LocalWritesStock on PantryItem {
    quantity
    heldQuantity
    activeBatchCount
    condition
    version
  }
`;

const PANTRY = gql`
  query LocalWritesPantry {
    pantry(id: "pantry-1") {
      id
      stats {
        totalItems
      }
      itemsConnection(filters: {}, orderBy: {}) {
        totalCount
        edges {
          node {
            id
          }
        }
      }
    }
  }
`;

type Pantry = {
  pantry: {
    stats: { totalItems: number };
    itemsConnection: { edges: { node: { id: string } }[] };
  };
};

function setup() {
  const cache = makeCache();
  seedQuery(cache, {
    query: PANTRY,
    data: {
      pantry: {
        __typename: 'Pantry',
        id: 'pantry-1',
        stats: { __typename: 'PantryStats', totalItems: 1 },
        itemsConnection: {
          __typename: 'PantryItemConnection',
          totalCount: 1,
          edges: [
            {
              __typename: 'PantryItemEdge',
              node: { __typename: 'PantryItem', id: 'held' },
            },
          ],
        },
      },
    },
  });
  seedFragment(cache, {
    fragment: STOCK,
    data: {
      __typename: 'PantryItem',
      id: 'held',
      quantity: 10,
      heldQuantity: 10,
      activeBatchCount: 1,
      condition: ItemCondition.Good,
      version: 3,
    },
  });
  const table = {
    CreatePantryItem: createItem,
    UpdatePantryItemQuantity: setStock,
    DeletePantryItem: removeItem,
    CreatePantryItemUsage: drawStock,
    RestockPantryItem: addStock,
    ConvertExpiredToWaste: discardExpired,
  };
  return { cache, writes: new PendingWrites(cache, table), table };
}

type Setup = ReturnType<typeof setup>;

const shown = ({ cache }: Setup, optimistic = true) => {
  const pantry = cache.readQuery<Pantry>({ query: PANTRY, optimistic })?.pantry;
  return {
    ids: pantry?.itemsConnection.edges.map(({ node }) => node.id),
    total: pantry?.stats.totalItems,
  };
};

const stock = ({ cache }: Setup, optimistic = true) =>
  cache.readFragment<{
    quantity: number;
    heldQuantity: number;
    activeBatchCount: number;
    condition: ItemCondition;
    version: number;
  }>({ id: 'PantryItem:held', fragment: STOCK, optimistic });

const create = ({ writes }: Setup, id: string) => {
  const inputs: CreateItemInputs = {
    row: { pantryId: 'pantry-1', itemName: 'Milk', quantity: 2 },
    now: NOW,
  };
  return writes.begin(
    CreatePantryItemDocument,
    { input: { id, pantryId: 'pantry-1' } },
    inputs,
  );
};

const use = ({ writes }: Setup, amount: number) => {
  const inputs: DrawStockInputs = { delta: -amount, now: NOW };
  return writes.begin(
    CreatePantryItemUsageDocument,
    { input: { pantryItemId: 'held' } },
    inputs,
  );
};

const restock = ({ writes }: Setup, delta: number | null) => {
  const inputs: AddStockInputs = { delta, now: NOW, pantryId: 'pantry-1' };
  return writes.begin(
    RestockPantryItemDocument,
    { input: { id: 'held' } },
    inputs,
  );
};

const remove = ({ writes }: Setup, id: string) => {
  const inputs: RemoveItemInputs = { pantryId: 'pantry-1' };
  return writes.begin(DeletePantryItemDocument, { input: { id } }, inputs);
};

/**
 * The server answers with a read still in flight: Apollo writes the answer to
 * the root, then the write waits. The result lets the read land.
 */
function answeredWithReadInFlight(
  { cache, writes }: Setup,
  { id, document, variables }: PendingWrite,
  data: Record<string, unknown>,
): () => void {
  const land = readFenceOf(cache).begin();
  const stated = completeSeed(document, variables, data);
  seedQuery(cache, {
    id: 'ROOT_MUTATION',
    query: document,
    variables,
    data: stated,
  });
  writes.confirm(id, stated);
  writes.rebuild();
  return land;
}

describe('creating a stack', () => {
  it('shows it and counts it once, however often it is rebuilt', () => {
    const pantry = setup();

    create(pantry, 'minted');
    pantry.writes.rebuild();
    pantry.writes.rebuild();

    expect(shown(pantry)).toEqual({ ids: ['minted', 'held'], total: 2 });
  });

  it('leaves the server data as it was', () => {
    const pantry = setup();

    create(pantry, 'minted');

    expect(shown(pantry, false)).toEqual({ ids: ['held'], total: 1 });
    expect(pantry.cache.extract()).not.toHaveProperty(['PantryItem:minted']);
  });

  it('goes without a trace when it is refused', () => {
    const pantry = setup();

    pantry.writes.drop(create(pantry, 'minted').id);

    expect(shown(pantry)).toEqual({ ids: ['held'], total: 1 });
    expect(pantry.cache.extract(true)).not.toHaveProperty([
      'PantryItem:minted',
    ]);
  });

  it('lists the row the server kept, counted by its answer', () => {
    const pantry = setup();
    const { id } = create(pantry, 'minted');
    // Apollo writes the answer's row before the write commits.
    seedFragment(pantry.cache, {
      fragment: STOCK,
      data: { __typename: 'PantryItem', id: 'minted', version: 1 },
    });

    pantry.writes.confirm(id, {
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        pantryItem: { __typename: 'PantryItem', id: 'minted' },
        pantry: { id: 'pantry-1', stats: { totalItems: 2 } },
      },
    });
    pantry.writes.rebuild();

    expect(shown(pantry, false).ids).toEqual(['minted', 'held']);
    expect(shown(pantry, false).total).toBe(1);
  });

  it('leaves one stack when the server joined it to a held one', () => {
    const pantry = setup();
    const { id } = create(pantry, 'minted');

    pantry.writes.confirm(id, {
      createPantryItem: {
        __typename: 'CreatePantryItemPayload',
        pantryItem: { __typename: 'PantryItem', id: 'held' },
      },
    });
    pantry.writes.rebuild();

    expect(shown(pantry).ids).toEqual(['held']);
    expect(pantry.cache.extract(true)).not.toHaveProperty([
      'PantryItem:minted',
    ]);
  });
});

describe('stock changes', () => {
  it('reads two uses as two, through a restart', () => {
    const pantry = setup();
    const first = use(pantry, 2);
    const second = use(pantry, 3);
    expect(stock(pantry)).toMatchObject({ quantity: 5, heldQuantity: 5 });

    const restarted = new PendingWrites(pantry.cache, pantry.table);
    pantry.writes.clear();
    expect(stock(pantry)).toMatchObject({ quantity: 10, heldQuantity: 10 });

    // The queue stores each write as JSON.
    restarted.restore(JSON.parse(JSON.stringify([first, second])));

    expect(stock(pantry)).toMatchObject({ quantity: 5, heldQuantity: 5 });
    expect(stock(pantry, false)).toMatchObject({ quantity: 10 });
  });

  it('moves nothing for an amount only the server can convert', () => {
    const pantry = setup();
    const inputs: DrawStockInputs = { delta: null, now: NOW };

    pantry.writes.begin(
      CreatePantryItemUsageDocument,
      { input: { pantryItemId: 'held' } },
      inputs,
    );

    expect(stock(pantry)).toMatchObject({ quantity: 10 });
  });

  it('puts the stock back when a use is refused', () => {
    const pantry = setup();

    pantry.writes.drop(use(pantry, 2).id);

    expect(stock(pantry)).toMatchObject({ quantity: 10, heldQuantity: 10 });
  });

  it('counts a restock as a batch of its own', () => {
    const pantry = setup();

    restock(pantry, 4);
    pantry.writes.rebuild();

    expect(stock(pantry)).toMatchObject({
      quantity: 14,
      heldQuantity: 14,
      activeBatchCount: 2,
    });
  });

  it('sets an amount over whatever the server holds', () => {
    const pantry = setup();
    const inputs: SetStockInputs = { held: 7, now: NOW };

    pantry.writes.begin(
      UpdatePantryItemQuantityDocument,
      { input: { pantryItemId: 'held' } },
      inputs,
    );
    seedFragment(pantry.cache, {
      fragment: STOCK,
      data: { __typename: 'PantryItem', id: 'held', quantity: 12 },
    });
    pantry.writes.rebuild();

    expect(stock(pantry)).toMatchObject({ quantity: 7, heldQuantity: 7 });
  });

  it('adds nothing on top of an answer a read holds back', () => {
    const pantry = setup();
    const write = use(pantry, 2);

    answeredWithReadInFlight(pantry, write, {
      createPantryItemUsage: {
        __typename: 'CreatePantryItemUsagePayload',
        pantryItemUsage: {
          id: 'usage-1',
          pantryItem: { id: 'held', quantity: 8, heldQuantity: 8 },
        },
      },
    });

    expect(stock(pantry)).toMatchObject({ quantity: 8, heldQuantity: 8 });
  });

  it('lands on the survivor of a merged stack, and the merged row goes', async () => {
    jest.useFakeTimers();
    const pantry = setup();
    const write = use(pantry, 2);

    pantry.writes.confirm(write.id, {
      createPantryItemUsage: {
        __typename: 'CreatePantryItemUsagePayload',
        pantry: { id: 'pantry-1' },
        pantryItemUsage: {
          pantryItem: { __typename: 'PantryItem', id: 'survivor' },
        },
      },
    });
    seedFragment(pantry.cache, {
      fragment: STOCK,
      data: { __typename: 'PantryItem', id: 'survivor', version: 1 },
    });
    await drainTimers();
    jest.useRealTimers();

    expect(pantry.cache.extract()).not.toHaveProperty(['PantryItem:held']);
  });
});

describe('removing a stack', () => {
  it('hides it and counts it out once, however often it is rebuilt', () => {
    const pantry = setup();

    remove(pantry, 'held');
    pantry.writes.rebuild();

    expect(shown(pantry)).toEqual({ ids: [], total: 0 });
    expect(shown(pantry, false)).toEqual({ ids: ['held'], total: 1 });
  });

  it('brings it back when refused', () => {
    const pantry = setup();

    pantry.writes.drop(remove(pantry, 'held').id);

    expect(shown(pantry)).toEqual({ ids: ['held'], total: 1 });
    expect(stock(pantry)).toMatchObject({ quantity: 10 });
  });

  it('leaves no row behind the answer that names it', () => {
    const pantry = setup();
    const { id } = remove(pantry, 'held');

    pantry.writes.confirm(id, {
      deletePantryItem: {
        __typename: 'DeletePantryItemPayload',
        pantryItem: { id: 'held' },
      },
    });
    pantry.writes.rebuild();

    expect(shown(pantry, false)).toEqual({ ids: [], total: 0 });
    expect(pantry.cache.extract()).not.toHaveProperty(['PantryItem:held']);
  });

  it('counts nothing for a row a realtime event already took', () => {
    const pantry = setup();
    const { id } = remove(pantry, 'gone');

    pantry.writes.confirm(id, {
      deletePantryItem: {
        __typename: 'DeletePantryItemPayload',
        converged: true,
        pantryItem: null,
      },
    });
    pantry.writes.rebuild();

    expect(shown(pantry, false)).toEqual({ ids: ['held'], total: 1 });
  });

  it('counts it out once while a read holds the answer', async () => {
    jest.useFakeTimers();
    const pantry = setup();
    const land = answeredWithReadInFlight(pantry, remove(pantry, 'held'), {
      deletePantryItem: {
        __typename: 'DeletePantryItemPayload',
        pantryItem: { id: 'held' },
        pantry: { id: 'pantry-1', stats: { totalItems: 0 } },
      },
    });
    expect(shown(pantry)).toEqual({ ids: [], total: 0 });

    land();
    await drainTimers();
    jest.useRealTimers();

    expect(shown(pantry, false)).toEqual({ ids: [], total: 0 });
  });
});

describe('discarding what expired', () => {
  const discard = ({ writes }: Setup, whole: boolean) => {
    const inputs: DiscardExpiredInputs = { whole, now: NOW };
    return writes.begin(
      ConvertExpiredToWasteDocument,
      { input: { pantryItemId: 'held' } },
      inputs,
    );
  };

  it('empties a stack with no batches until the server answers', () => {
    const pantry = setup();

    discard(pantry, true);

    expect(stock(pantry)).toMatchObject({
      quantity: 0,
      heldQuantity: 0,
      condition: ItemCondition.Spoiled,
    });
  });

  it('leaves a batched stack for the server to recompute', () => {
    const pantry = setup();

    discard(pantry, false);

    expect(stock(pantry)).toMatchObject({ quantity: 10 });
  });

  it('puts an emptied stack back when refused', () => {
    const pantry = setup();

    pantry.writes.drop(discard(pantry, true).id);

    expect(stock(pantry)).toMatchObject({
      quantity: 10,
      condition: ItemCondition.Good,
    });
  });
});

describe('a pantry', () => {
  const HOME = gql`
    fragment LocalWritesHome on Home {
      pantries {
        id
      }
    }
  `;

  const HOME_PANTRY = gql`
    fragment LocalWritesHomePantry on Pantry {
      name
    }
  `;

  function seededHome() {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: HOME,
      data: {
        __typename: 'Home',
        id: 'home-1',
        pantries: [{ __typename: 'Pantry', id: 'held-pantry' }],
      },
    });
    return {
      cache,
      writes: new PendingWrites(cache, {
        CreatePantry: createPantry,
        DeletePantry: removePantry,
      }),
    };
  }

  type Home = ReturnType<typeof seededHome>;

  const pantries = ({ cache }: Home, optimistic = true) =>
    cache
      .readFragment<{ pantries: { id: string }[] }>({
        id: 'Home:home-1',
        fragment: HOME,
        optimistic,
      })
      ?.pantries.map(({ id }) => id);

  const make = ({ writes }: Home) => {
    const inputs: CreatePantryInputs = {
      pantry: { id: 'minted', homeId: 'home-1', name: 'Garage' },
      today: '2026-10-30',
    };
    return writes.begin(
      CreatePantryDocument,
      { input: inputs.pantry, today: inputs.today },
      inputs,
    );
  };

  const drop = ({ writes }: Home) => {
    const inputs: RemovePantryInputs = { homeId: 'home-1' };
    return writes.begin(
      DeletePantryDocument,
      { input: { id: 'held-pantry' } },
      inputs,
    );
  };

  it('shows a new pantry under its home, however often it is rebuilt', () => {
    const home = seededHome();

    make(home);
    home.writes.rebuild();

    expect(pantries(home)).toEqual(['held-pantry', 'minted']);
    expect(pantries(home, false)).toEqual(['held-pantry']);
  });

  it('leaves nothing of a refused pantry', () => {
    const home = seededHome();

    home.writes.drop(make(home).id);

    expect(pantries(home)).toEqual(['held-pantry']);
    expect(home.cache.extract(true)['Pantry:minted']).toBeUndefined();
  });

  it('lists an answered pantry in the server data', () => {
    const home = seededHome();
    const { id } = make(home);
    // Apollo writes the answer's row before the write commits.
    seedFragment(home.cache, {
      fragment: HOME_PANTRY,
      data: { __typename: 'Pantry', id: 'minted', name: 'Garage' },
    });

    home.writes.confirm(id, {
      createPantry: {
        __typename: 'CreatePantryPayload',
        pantry: { id: 'minted', homeId: 'home-1' },
      },
    });
    home.writes.rebuild();

    expect(pantries(home, false)).toEqual(['held-pantry', 'minted']);
  });

  it('hides a deleted pantry, and brings it back when refused', () => {
    const home = seededHome();

    const { id } = drop(home);
    expect(pantries(home)).toEqual([]);
    expect(pantries(home, false)).toEqual(['held-pantry']);

    home.writes.drop(id);
    expect(pantries(home)).toEqual(['held-pantry']);
  });
});
