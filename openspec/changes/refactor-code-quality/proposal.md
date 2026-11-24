# Improve type safety without changing behavior

Expose the existing full-details worker query type for literal fullDetails:true callers; remove artificial never casts from schedule mutation builders and correct a stale comment. Preserve query keys, filters, projections, mutation result shapes and error behavior (except typo). No dependencies or schema changes.
