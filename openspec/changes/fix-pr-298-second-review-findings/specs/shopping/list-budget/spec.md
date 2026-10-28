# Spec Delta

## Purpose

Defines who may change a shopping list's money on the Budget & prices screen
(its budget, the store it is kept for, and price tracking) and what everyone
else sees there.

## ADDED Requirements

### Requirement: Whoever may edit the list may change its money

The Budget & prices screen SHALL offer its budget field, store picker and
price-tracking switch to every viewer who may edit the list: its owner, a
member or above of the home the list belongs to, and a collaborator who may
edit. Others SHALL see the same values read-only.

#### Scenario: A home member opens a list another member created

- **WHEN** a MEMBER of a home opens Budget & prices on a home list someone else created
- **THEN** the budget field, store picker and price-tracking switch are editable

#### Scenario: A collaborator who may edit

- **WHEN** a collaborator who may edit the list opens Budget & prices
- **THEN** the budget field, store picker and price-tracking switch are editable

#### Scenario: A collaborator who may only view

- **WHEN** a collaborator without edit rights opens Budget & prices
- **THEN** the budget, store and price tracking are shown and none of them can be changed

#### Scenario: The list's permissions have not loaded

- **WHEN** Budget & prices opens before the list's ownership and permissions are known
- **THEN** no control is offered until they are known
