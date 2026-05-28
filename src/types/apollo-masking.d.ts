// Register Apollo Client 4.x data masking HKT so `FragmentType<typeof Doc>`,
// `Unmasked<T>`, and `MaybeMasked<T>` resolve correctly against the
// graphql-codegen-emitted `$fragmentName` / `$fragmentRefs` marker shapes.
//
// Required because codegen.ts uses `inlineFragmentTypes: 'mask'` and
// `dataMasking: true`. Without this declaration merging, `FragmentType<X>`
// resolves to `never` (the PreserveTypes default).
//
// See: https://www.apollographql.com/docs/react/data/fragments#registering-data-masking-implementation
import type { GraphQLCodegenDataMasking } from '@apollo/client/masking';

declare module '@apollo/client' {
  export interface TypeOverrides
    extends GraphQLCodegenDataMasking.TypeOverrides {}
}
