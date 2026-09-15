import { testRule } from '#/test-utils/eslintRuleTester';

testRule('no-optimistic-response-cast', {
  valid: ['useMutation(doc, { optimisticResponse: build(cache) });'],
  invalid: [
    {
      code: 'useMutation(doc, { optimisticResponse: { item: { __typename: "X", id } as T } });',
      errors: ['castPartialEntity'],
    },
  ],
});
