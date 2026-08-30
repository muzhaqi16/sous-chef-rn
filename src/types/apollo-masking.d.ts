// Registers Apollo's data-masking HKT so `FragmentType<typeof Doc>`,
// `Unmasked<T>` and `MaybeMasked<T>` resolve against codegen's `$fragmentName`
// markers. Without this declaration merging `FragmentType<X>` is `never`.
import type { GraphQLCodegenDataMasking } from '@apollo/client/masking';

declare module '@apollo/client' {
  export interface TypeOverrides
    extends GraphQLCodegenDataMasking.TypeOverrides {}
}
