// Declare the client-wide default options so Apollo's types reflect them.
//
// Apollo Client 4.2 made this mandatory: `DefaultOptions.Input` now requires a
// matching `ApolloClient.DeclareDefaultOptions` declaration for `errorPolicy`
// (and `returnPartialData` on watchQuery), and without it the assignment in
// `src/apollo/client.ts` fails to compile with the error text pointing here.
//
// It is a genuine improvement rather than a formality. `errorPolicy: 'all'` is
// the reason a failing mutation RESOLVES with `{ data: undefined, error }`
// instead of throwing — a rule the codebase states in prose and enforces by
// review. Declaring it makes the type system carry that contract instead, so
// `data` is typed as possibly-absent-alongside-an-error at every call site.
//
// `returnPartialData: false` is declared explicitly, and deliberately. It is
// what makes an incomplete cache read yield NO data rather than a partial
// object, which is why every optimistic entity must be written complete for
// every query that reads it (see `buildOptimisticPantryItem` and
// `__tests__/apollo/optimisticEntityCompleteness.test.ts`). Flipping it is a
// real architectural choice, not a tweak — and it is now stated in one place
// where a reader can find it.
//
// See: https://www.apollographql.com/docs/react/data/typescript#declaring-default-options-for-type-safety
import '@apollo/client';

declare module '@apollo/client' {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      // Non-optional on purpose. Apollo 4.2 switches every method and hook in
      // the app from "classic" to "modern" signatures the moment ANY
      // non-optional property appears here, and modern signatures are what we
      // want: they fold these defaults into every return type, so
      // `errorPolicy: 'all'` is expressed in the types rather than in prose,
      // and `data` is correctly typed as possibly-absent-alongside-an-error at
      // every call site.
      //
      // The cost was dropping manually-passed generics (`client.mutate<T>()`,
      // `useQuery<T>()`), which modern signatures reject. Those were redundant
      // wherever the document is a `TypedDocumentNode`; the two places with a
      // genuinely untyped `DocumentNode` (the offline queue's replay, the
      // hybrid-search hook) now carry the shape on the document via a local
      // cast, which is where inference can use it.
      interface WatchQuery {
        errorPolicy: 'all';
        returnPartialData: false;
      }
      interface Query {
        errorPolicy: 'all';
      }
      interface Mutate {
        errorPolicy: 'all';
      }
    }
  }
}
