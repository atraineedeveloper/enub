# Dependency security

Establish a read-only audit of the resolved Bun dependency graph in CI. Initially report findings without blocking existing builds; classify findings, then upgrade compatible packages and regenerate the lockfile in a reproducible Bun environment. Do not claim remediation until a subsequent audit and regression tests pass. No production changes or new runtime dependencies.
