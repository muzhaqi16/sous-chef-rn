// The client-wide defaults, declared so the TYPES carry them; Apollo 4.2 needs
// this for the assignment in `src/apollo/client.ts` to compile.
import '@apollo/client';

declare module '@apollo/client' {
  // The resync triggers `src/apollo/refetchEvents.ts` feeds the client's
  // `RefetchEventManager`; a query's `refetchOn` may name each one.
  interface RefetchEvents {
    appForeground: void;
    apiReachable: void;
    wsReconnected: void;
    /** At the switch itself. */
    languageChanged: void;
    /** The caller left a home or was removed from one: its lists, plans and
     *  templates stay with the household. */
    householdLeft: void;
    /** On each navigation after a switch or a resync: what it left unshown. */
    screenShown: void;
  }

  namespace ApolloClient {
    namespace DeclareDefaultOptions {
      // Non-optional on purpose: ANY non-optional property switches every
      // method and hook to Apollo 4.2's "modern" signatures, which fold these
      // defaults into the return types and reject manual generics (`useQuery<T>()`).
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
