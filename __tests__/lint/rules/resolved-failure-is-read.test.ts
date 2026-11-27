import { testRule } from '#/test-utils/eslintRuleTester';

const MUTATION = 'const [save] = useMutation(SaveDocument);\n';
const LOCAL = 'const write = useLocalWrite(binding, settle);\n';

testRule('resolved-failure-is-read', {
  valid: [
    // The failure is read from the result.
    `${MUTATION}async function go() { try { const result = await save(); if (result.error) return; } catch (e) { log(e); } }`,
    `${MUTATION}async function go() { try { const { data, error } = await save(); use(data, error); } catch (e) { log(e); } }`,
    // Handed on to code that reads it.
    `${MUTATION}async function go() { try { const result = await save(); return settleMutation(result); } catch (e) { log(e); } }`,
    `${LOCAL}async function go() { try { const settled = await write.send(vars); if (settled.status === 'failed') return; } catch (e) { log(e); } }`,
    // Not guarded at all: nothing claims to catch the failure.
    `${MUTATION}async function go() { const result = await save(); use(result.data); }`,
    // Not a send: the same name from elsewhere.
    'async function go() { try { await save(); } catch (e) { log(e); } }',
    `${MUTATION}function go() { save().then(result => use(result.error)).catch(log); }`,
    // The catch folds a throw into the same shape, and the shape is read.
    'const [preview] = useLazyQuery(PreviewDocument);\nasync function go() { const result = await preview().catch(error => ({ data: undefined, error })); if (result.error) fail(result.error); }',
    // A failure that rejects is what a catch is for.
    "const client = useApolloClient();\nasync function go() { try { const { data } = await client.mutate({ mutation: M, errorPolicy: 'none' }); use(data); } catch (e) { log(e); } }",
    // A named handler takes the result on.
    `${MUTATION}function go() { save().then(settle).catch(log); }`,
    // The hook's own state carries the failure.
    'const [search, { data, error }] = useLazyQuery(SearchDocument);\nfunction go() { void search({ variables }).catch(log); }',
  ],
  invalid: [
    {
      // Discarded inside a try: a resolved failure passes for success.
      code: `${MUTATION}async function go() { try { await save(); done(); } catch (e) { log(e); } }`,
      errors: ['failureUnread'],
    },
    {
      // Only the data is read.
      code: `${MUTATION}async function go() { try { const result = await save(); use(result.data); } catch (e) { log(e); } }`,
      errors: ['failureUnread'],
    },
    {
      code: `${MUTATION}async function go() { try { const { data } = await save(); use(data); } catch (e) { log(e); } }`,
      errors: ['failureUnread'],
    },
    {
      // A lazy query resolves its failure too.
      code: 'const [preview] = useLazyQuery(PreviewDocument);\nasync function go() { try { const { data } = await preview(); show(data); } catch (e) { fail(e); } }',
      errors: ['failureUnread'],
    },
    {
      code: `${LOCAL}function go() { write.send(vars).catch(log); }`,
      errors: ['failureUnread'],
    },
    {
      code: 'const client = useApolloClient();\nasync function go() { try { const { data } = await client.query({ query: Q }); use(data); } catch (e) { log(e); } }',
      errors: ['failureUnread'],
    },
    {
      code: `${MUTATION}function go() { save().then(({ data }) => use(data)).catch(log); }`,
      errors: ['failureUnread'],
    },
  ],
});
