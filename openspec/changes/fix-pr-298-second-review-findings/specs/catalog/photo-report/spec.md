# Spec Delta

## Purpose

Defines which photo "Report wrong photo" names on an item's detail screen,
whose hero shows several of the item's photos as pages.

## ADDED Requirements

### Requirement: The report names the photo on screen

"Report wrong photo" SHALL name the catalog photo shown on the hero's current
page. On a page that shows the household's own upload, or the user's photo
still awaiting review, it SHALL NOT report.

#### Scenario: The user swipes to another photo and reports it

- **WHEN** the hero shows three approved catalog photos and the user swipes to the third
- **AND** taps "Report wrong photo" and confirms
- **THEN** the report names the third photo

#### Scenario: The first page is shown

- **WHEN** the hero shows its first catalog photo and the user reports it
- **THEN** the report names that photo

#### Scenario: The household's own upload leads the gallery

- **WHEN** the hero's first page is the household's own upload
- **THEN** that page offers no "Report wrong photo" action, and the next page's catalog photo can be reported

#### Scenario: The user's photo awaiting review

- **WHEN** the current page shows the user's own photo awaiting review
- **THEN** the action explains that the photo is pending review and sends no report
