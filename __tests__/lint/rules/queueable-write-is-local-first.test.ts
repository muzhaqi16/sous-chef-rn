import { testRule } from '#/test-utils/eslintRuleTester';

// `UpdatePantryItemQuantityDocument` is in SYNC_REGISTRY; `GetPantryDocument`
// is not, so it stands in for a write the queue never takes.
testRule('queueable-write-is-local-first', {
  valid: [
    'const [fire] = useMutation(UpdatePantryItemQuantityDocument); fire({ variables, context: { localFirst: true } });',
    // The options object is followed to its declaration.
    'const [fire] = useMutation(UpdatePantryItemQuantityDocument); const options = { context: { localFirst: true } }; fire(options);',
    // Not in the registry: the queue never takes it, so no marker is needed.
    'const [fire] = useMutation(GetPantryDocument); fire({ variables });',
    'client.mutate({ mutation: UpdatePantryItemQuantityDocument, context: { localFirst: true } });',
    'client.mutate({ mutation: GetPantryDocument });',
    // An optimisticResponse is fine on a write the queue does not take.
    'const [fire] = useMutation(GetPantryDocument, { optimisticResponse: build() }); fire({ variables });',
  ],
  invalid: [
    {
      code: 'const [fire] = useMutation(UpdatePantryItemQuantityDocument); fire({ variables });',
      errors: ['missingLocalFirst'],
    },
    {
      code: 'const [fire] = useMutation(UpdatePantryItemQuantityDocument); const options = { variables }; fire(options);',
      errors: ['missingLocalFirst'],
    },
    {
      code: 'client.mutate({ mutation: UpdatePantryItemQuantityDocument, variables });',
      errors: ['missingLocalFirst'],
    },
    {
      // The queued completion reverts the optimistic layer on screen.
      code: 'const [fire] = useMutation(UpdatePantryItemQuantityDocument); fire({ context: { localFirst: true }, optimisticResponse: build() });',
      errors: ['optimisticWithLocalFirst'],
    },
    {
      // Declared on the hook rather than the call, same defect.
      code: 'const [fire] = useMutation(UpdatePantryItemQuantityDocument, { optimisticResponse: build() }); fire({ context: { localFirst: true } });',
      errors: ['optimisticWithLocalFirst'],
    },
    {
      code: 'client.mutate({ mutation: UpdatePantryItemQuantityDocument, context: { localFirst: true }, optimisticResponse: build() });',
      errors: ['optimisticWithLocalFirst'],
    },
  ],
});
