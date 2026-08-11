# Proposal: harden PWA update flow

## Why

ENU is an installable PWA with multiple data-entry forms. The current service worker uses `autoUpdate` while the application does not expose an update UI. That makes update behavior opaque and can create a poor experience when a new release becomes available while a user is entering data.

The current PWA does not intentionally cache Supabase API responses or worker documents, and this change must preserve that boundary.

## What changes

- switch the service-worker update behavior from automatic activation to an explicit update prompt;
- register the service worker from application code so ENU can surface update state;
- let users apply a new version after saving their work or postpone the prompt temporarily;
- periodically ask the browser to check for a newer service worker while ENU remains open;
- keep offline scope limited to the application shell/static build assets;
- add focused automated coverage for the prompt behavior and update lifecycle.

## Out of scope

- offline mutations or background synchronization;
- caching Supabase responses, authentication state, worker records, schedules or documents;
- changing Supabase, authentication or authorization;
- introducing a new dependency.

## Impact

Users can continue working on an existing release until they explicitly choose to update. When they update, ENU activates the waiting service worker and reloads into the new release. Dynamic data operations continue to require network access.