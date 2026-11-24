# Worker form layout

## ADDED Requirements
### Requirement: Grouped worker form
The worker form SHALL provide four navigable sections and retain entered data while navigating.
#### Scenario: Switch sections
- WHEN the user moves between sections
- THEN the form retains registered inputs and selected files without submitting.
#### Scenario: Invalid submission
- WHEN validation fails
- THEN the first affected section is shown and its error is announced or focused.
