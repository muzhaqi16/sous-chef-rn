// Declares the client-wide defaults so the TYPES carry them: `errorPolicy:
// 'all'` is why a failing mutation resolves with `{ data: undefined, error }`
// rather than throwing, and `returnPartialData: false` is why an incomplete
// cache read yields NO data. Apollo 4.2 requires this declaration for the
// assignment in `src/apollo/client.ts` to compile.
import '@apollo/client';

declare module '@apollo/client' {
  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      // Non-optional on purpose: ANY non-optional property here switches every
      // method and hook to Apollo 4.2's "modern" signatures, which fold these
      // defaults into every return type. The cost is that modern signatures
      // reject manually-passed generics (`useQuery<T>()`).
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
