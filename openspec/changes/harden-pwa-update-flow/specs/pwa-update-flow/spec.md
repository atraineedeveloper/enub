# PWA update flow

## Requirement: updates do not interrupt active work

ENU MUST NOT automatically reload an open client when a new application release becomes available.

### Scenario: new release detected

- GIVEN a user has ENU open
- WHEN the service worker detects a waiting application release
- THEN ENU shows a non-blocking update prompt
- AND the current page remains active until the user chooses to update.

### Scenario: user applies the update

- GIVEN a new release is waiting
- WHEN the user chooses `Actualizar ahora`
- THEN ENU activates the waiting service worker
- AND reloads the page into the new release.

### Scenario: user postpones the update

- GIVEN a new release is waiting
- WHEN the user chooses `Más tarde`
- THEN ENU hides the update prompt without reloading
- AND makes the prompt available again after the postpone period while the update remains pending.

## Requirement: long-lived clients check for releases

After successful service-worker registration, ENU MUST periodically ask the browser registration to check for updates while the application remains open.

A failed service-worker registration or update check MUST NOT prevent the normal online web application from loading or operating.

## Requirement: PWA caching remains limited

This change MUST NOT add runtime caching for Supabase API responses, authentication requests, worker/schedule data, uploads, downloads or worker documents.

The PWA MAY precache the application shell and static build assets required for installation and shell rendering.