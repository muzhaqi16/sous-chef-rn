import { gql } from '@apollo/client';
import { fragmentsCarried, fragmentsNeeded } from '../fragmentsOnEntities';

const Fragments = `
  fragment Origin_product on Product {
    id
    origin
  }
  fragment Price_product on Product {
    id
    price
    store {
      id
      ...Store_store
    }
  }
  fragment Store_store on Store {
    id
    name
  }
`;

const Lookup = gql`
  query Lookup($code: String!, $withPrice: Boolean = false) {
    lookup(code: $code) {
      edges {
        node {
          id
          name
          ...Origin_product
          ...Price_product @include(if: $withPrice)
        }
      }
      totalCount
    }
  }
  ${Fragments}
`;

const lookupData = {
  lookup: {
    __typename: 'ProductConnection',
    edges: [
      {
        __typename: 'ProductEdge',
        node: {
          __typename: 'Product',
          id: 'p1',
          name: 'Pasta',
          origin: 'IT',
          price: 3,
          store: { __typename: 'Store', id: 's1', name: 'Corner' },
        },
      },
    ],
    totalCount: 1,
  },
};

const ByIdQuery = gql`
  query OriginById($id: ID!) {
    product(id: $id) {
      id
      ...Origin_product
    }
  }
  ${Fragments}
`;

const masked = { product: { __typename: 'Product', id: 'p1' } };

describe('fragmentsCarried', () => {
  it('keys each fragment by the entity it holds, nested ones included', () => {
    expect(
      fragmentsCarried(Lookup, { code: '1', withPrice: true }, lookupData),
    ).toEqual(
      new Set([
        'Origin_product@Product:p1',
        'Price_product@Product:p1',
        'Store_store@Store:s1',
      ]),
    );
  });

  it('leaves out a fragment its variables exclude', () => {
    expect(
      fragmentsCarried(Lookup, { code: '1', withPrice: false }, lookupData),
    ).toEqual(new Set(['Origin_product@Product:p1']));
  });

  it('carries nothing without data', () => {
    expect(fragmentsCarried(Lookup, { code: '1' }, undefined).size).toBe(0);
  });
});

describe('fragmentsNeeded', () => {
  it('names the fragments a by-id query reads, from its masked data', () => {
    expect(fragmentsNeeded(ByIdQuery, { id: 'p1' }, masked)).toEqual(
      new Set(['Origin_product@Product:p1']),
    );
  });

  it('is null for a query that reads a field of its own', () => {
    const query = gql`
      query NamedById($id: ID!) {
        product(id: $id) {
          id
          name
          ...Origin_product
        }
      }
      ${Fragments}
    `;

    expect(fragmentsNeeded(query, { id: 'p1' }, masked)).toBeNull();
  });

  // `currentProduct` may name another product by now.
  it('is null for a root field that does not look its entity up by id', () => {
    const query = gql`
      query Current {
        currentProduct {
          id
          ...Origin_product
        }
      }
      ${Fragments}
    `;

    expect(
      fragmentsNeeded(query, {}, { currentProduct: masked.product }),
    ).toBeNull();
  });

  it('is null while the query has no data', () => {
    expect(fragmentsNeeded(ByIdQuery, { id: 'p1' }, undefined)).toBeNull();
    expect(fragmentsNeeded(ByIdQuery, { id: 'p1' }, { product: null })).toBe(
      null,
    );
  });

  it('is null for a query that reads only key fields', () => {
    const query = gql`
      query KeyById($id: ID!) {
        product(id: $id) {
          id
        }
      }
    `;

    expect(fragmentsNeeded(query, { id: 'p1' }, masked)).toBeNull();
  });
});
