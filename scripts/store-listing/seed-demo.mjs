#!/usr/bin/env node
/**
 * Fills the store-screenshot account on the LOCAL API with one home of
 * photographed food, this week's meal plan and a shopping list, dated from
 * today so expiry badges and "Meals today" read right in a fresh capture.
 *
 *   STORE_DEMO_PASSWORD=… node scripts/store-listing/seed-demo.mjs [--reset]
 *
 * The account (`STORE_DEMO_EMAIL`, default store-demo@souschef.dev) must belong
 * to no other home: recipe suggestions pool every pantry the user can reach, so
 * a second home's food shows up in the shots. `--reset` deletes the account's
 * homes first. Item and recipe ids are the local catalog's; one that went
 * missing is reported and skipped.
 */
const API = process.env.API_URL ?? 'http://localhost:4000/graphql';
const EMAIL = process.env.STORE_DEMO_EMAIL ?? 'store-demo@souschef.dev';
const PASSWORD = process.env.STORE_DEMO_PASSWORD;
const RESET = process.argv.includes('--reset');

if (!PASSWORD) throw new Error('Set STORE_DEMO_PASSWORD');
if (!['localhost', '127.0.0.1'].includes(new URL(API).hostname)) {
  throw new Error(
    `Refusing to seed ${API}: the demo account lives on the local API only`,
  );
}

const ERR =
  '... on ValidationError { message } ... on ConflictError { message } ... on ForbiddenError { message } ... on NotFoundError { message }';
let token = null;

async function gql(query, variables = {}) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'apollo-require-preflight': 'true',
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(body.errors[0].message);
  return body.data;
}

/** A result union's payload, or a warning naming what was refused. */
function payload(result, what) {
  if (result.__typename.endsWith('Payload')) return result;
  console.warn(`skipped ${what}: ${result.__typename} ${result.message ?? ''}`);
  return null;
}

const day = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
};

// [catalog item id, quantity, unit symbol, days until expiry, storage state, location, low-stock minimum]
const PANTRY = [
  ['6947193f0347cb1c521221f4', 1, 'gal', 11, 'REFRIGERATED', 'Fridge'], // milk
  ['6947193f0347cb1c521221f0', 4, 'pc', 15, 'REFRIGERATED', 'Fridge', 6], // eggs
  ['69088b42915c6f81a11b9d38', 1, 'tub', 3, 'REFRIGERATED', 'Fridge'], // Greek yogurt
  ['6946dccf0b857e2533329f37', 1, 'bag', 2, 'REFRIGERATED', 'Fridge'], // spinach
  ['cmlzknz09002bxdepsswjbami', 1, 'block', 53, 'REFRIGERATED', 'Fridge'], // parmesan
  ['6946caa3f4dc0edac5ef7a9a', 1, 'lb', 48, 'REFRIGERATED', 'Fridge'], // butter
  ['cmlzknz0x002exdepm9q1s5yf', 8, 'oz', 13, 'REFRIGERATED', 'Fridge'], // mozzarella
  ['cmlq3riq3000b9yepgq24sacm', 1.5, 'lb', 2, 'REFRIGERATED', 'Fridge'], // chicken breast
  ['6947193f0347cb1c521221f6', 3, 'pc', 12, 'REFRIGERATED', 'Fridge'], // bell pepper
  ['6945cf3a52eb5549977864a7', 2, 'lb', 18, 'REFRIGERATED', 'Fridge'], // carrots
  ['69088e04c7ae5f3915baaefa', 1, 'bunch', 9, 'REFRIGERATED', 'Fridge'], // cilantro
  ['69471a170347cb1c52122207', 8, 'oz', 10, 'REFRIGERATED', 'Fridge'], // mushrooms
  ['694826e16a94df1a161816dd', 4, 'pc', 17, 'REFRIGERATED', 'Fridge'], // lemon
  ['69088b50915c6f81a11b9fd4', 1, 'pt', 9, 'REFRIGERATED', 'Fridge'], // blueberries
  ['6948b05d7fd1126814df4ab4', 1, 'lb', 84, 'FROZEN', 'Freezer'], // salmon
  ['69613846b78a12477dd0df20', 1, 'lb', 216, 'AMBIENT', 'Pantry'], // pasta
  ['698ead40a2821e1f8e4441e9', 2, 'lb', 308, 'AMBIENT', 'Pantry'], // rice
  ['69088b48915c6f81a11b9e5c', 1, 'btl', 185, 'AMBIENT', 'Pantry', 1], // olive oil
  ['69088b49915c6f81a11b9e8e', 2, 'head', 23, 'AMBIENT', 'Pantry'], // garlic
  ['6945d12552eb5549977864ec', 3, 'pc', 28, 'AMBIENT', 'Pantry'], // onion
  ['6946cc4470c2a5c982cad698', 4, 'pc', 10, 'AMBIENT', 'Counter'], // tomato
  ['695caf5689d026e70b81b877', 1, 'loaf', 9, 'AMBIENT', 'Counter'], // bread
  ['cmlq3rjrh000b8qeplep5snjf', 6, 'pc', 4, 'AMBIENT', 'Counter'], // bananas
  ['cmlq3rkd0000g8qepradiojix', 6, 'pc', 21, 'AMBIENT', 'Counter'], // apples
  ['cmlzku6r6003kxdep9ywnzouf', 2, 'pc', 2, 'AMBIENT', 'Counter'], // avocado
  ['e9pbsi0fsqqulqc877p3lq2l', 1, 'jar', 430, 'AMBIENT', 'Pantry'], // honey
];
// [days from today, meal type, catalog recipe id]
const MEALS = [
  [-2, 'DINNER', 'c14jl26t7nejs2bax3wh1zuq'], // Greek Chicken
  [-1, 'DINNER', 'cor7qs90k8nzvgw91r5b828v'], // Cheesy Vegetable Lasagna
  [0, 'BREAKFAST', 'juapnn8fkr3yank9szr2ss24'], // Open Faced Asparagus Omelet
  [0, 'LUNCH', 'cmlzku6p7002sxdep8a2cjw7m'], // Chicken Spinach Salad
  [0, 'DINNER', 'c14jl26t7nejs2bax3wh1zuq'], // Greek Chicken
  [1, 'DINNER', 'sblytuwynktph0ribnicgsak'], // Southwestern Collard Wrap
  [2, 'DINNER', 'q2f3er2i9nwkqapgzhxkotbx'], // Vegetable Lasagna
  [3, 'BRUNCH', 'dxh44qdnwv62mc8x9cec9bjr'], // Spinach and Tomato Strata
  [4, 'DINNER', 'qhkkezw7fnh7rr3big74vpgb'], // Cuban Chicken
];
// [catalog item id, quantity, unit symbol]
const LIST = [
  ['69088b48915c6f81a11b9e5c', 1, 'btl'], // olive oil
  ['6947193f0347cb1c521221f0', 12, 'pc'], // eggs
  ['cmlzku6r6003kxdep9ywnzouf', 3, 'pc'], // avocado
  ['694826e16a94df1a161816dd', 2, 'pc'], // lemon
  ['photc4b50vahkr2woymbul4o', 4, 'pc'], // limes
  ['6948b05d7fd1126814df4ab4', 1, 'lb'], // salmon
  ['cmlq3rkd0000g8qepradiojix', 4, 'pc'], // apples
  ['69088b42915c6f81a11b9d38', 1, 'tub'], // Greek yogurt
  ['cmlzknz0x002exdepm9q1s5yf', 1, 'pkg'], // mozzarella
];

const login = await gql(
  'mutation($i:LoginInput!){ login(input:$i){ __typename ... on AuthPayload { accessToken } } }',
  { i: { email: EMAIL, password: PASSWORD } },
);
token = login.login.accessToken;
if (!token) throw new Error(`Login refused: ${login.login.__typename}`);

const { homes } = await gql(
  '{ homes(first: 10){ edges { node { id name } } } }',
);
if (homes.edges.length && !RESET) {
  throw new Error(
    `${EMAIL} already has ${homes.edges
      .map(e => e.node.name)
      .join(', ')}; rerun with --reset`,
  );
}
for (const { node } of homes.edges) {
  payload(
    (
      await gql(
        `mutation($i:DeleteHomeInput!){ deleteHome(input:$i){ __typename ${ERR} } }`,
        { i: { id: node.id } },
      )
    ).deleteHome,
    `deleting ${node.name}`,
  );
}

const home = payload(
  (
    await gql(
      `mutation($i:CreateHomeInput!){ createHome(input:$i){ __typename ... on CreateHomePayload { home { id pantriesConnection(first: 1){ edges { node { id } } } } } ${ERR} } }`,
      {
        i: {
          name: 'Our Kitchen',
          createDefaultPantry: true,
          defaultPantryName: 'Kitchen',
          allowJoinCode: false,
          currency: 'USD',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    )
  ).createHome,
  'the home',
).home;
const pantryId = home.pantriesConnection.edges[0].node.id;

for (const [
  id,
  quantity,
  symbol,
  expiresIn,
  storageState,
  location,
  minQuantity,
] of PANTRY) {
  const i = {
    pantryId,
    item: { id },
    today: day(0),
    amount: { measured: { quantity, unit: { symbol } } },
    expiresOn: day(expiresIn),
    storage: { storageState, location: { name: location } },
    ...(minQuantity && { thresholds: { minQuantity } }),
  };
  payload(
    (
      await gql(
        `mutation($i:CreatePantryItemInput!){ createPantryItem(input:$i){ __typename ${ERR} ... on DuplicatePantryItemError { message } ... on UnitEligibilityError { message } } }`,
        { i },
      )
    ).createPantryItem,
    `item ${id}`,
  );
}

// A weekly plan runs Monday to Sunday; meals falling outside this week are dropped.
const monday = -((new Date().getDay() + 6) % 7);
const plan = payload(
  (
    await gql(
      `mutation($i:CreateMealPlanInput!){ createMealPlan(input:$i){ __typename ... on CreateMealPlanPayload { mealPlan { id } } ${ERR} } }`,
      {
        i: {
          name: 'This week',
          homeId: home.id,
          planType: 'WEEKLY',
          startDate: day(monday),
          endDate: day(monday + 6),
          servings: 2,
        },
      },
    )
  ).createMealPlan,
  'the meal plan',
).mealPlan;
for (const [offset, mealType, recipeId] of MEALS.filter(
  ([o]) => o >= monday && o <= monday + 6,
)) {
  payload(
    (
      await gql(
        `mutation($i:CreateMealPlanItemInput!){ createMealPlanItem(input:$i){ __typename ${ERR} } }`,
        {
          i: {
            mealPlanId: plan.id,
            date: day(offset),
            mealType,
            meal: { recipeId },
            servings: 2,
          },
        },
      )
    ).createMealPlanItem,
    `meal ${recipeId}`,
  );
}

payload(
  (
    await gql(
      `mutation($i:CreateShoppingListInput!){ createShoppingList(input:$i){ __typename ${ERR} } }`,
      {
        i: {
          name: 'Weekly groceries',
          homeId: home.id,
          isDefault: true,
          items: LIST.map(([itemId, quantity, symbol]) => ({
            item: { itemId },
            quantity,
            unit: { symbol },
          })),
        },
      },
    )
  ).createShoppingList,
  'the shopping list',
);
console.log(
  `Seeded Our Kitchen for ${EMAIL}: ${PANTRY.length} pantry items, this week's plan, one list.`,
);
