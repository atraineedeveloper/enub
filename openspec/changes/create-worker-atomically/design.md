# Design

Candidate SQL is intentionally outside migrations until local CLI and pgTAP verification. Review existing INSERT privileges, status defaults and photo cleanup. After creating a migration via the CLI and validating it locally, regenerate database types and replace the client creation path with RPC. Do not deploy frontend before the RPC exists in its target environment. Photo storage is not transactional with PostgreSQL; retain compensating cleanup and distinguish ambiguous network failures.
