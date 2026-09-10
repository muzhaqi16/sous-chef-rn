# shoppingList/ui

Public shopping-list UI, the one directory in this feature open to its siblings.
`components/` stays private as usual.

A shopping-list picker is a shopping-list concept, and both recipes (add
ingredients) and pantry (add low-stock items) need it. It belongs in neither a
domain-free kit nor in one consumer, which is the same reasoning that put the
catalog's pickers in `catalog/ui/`.
