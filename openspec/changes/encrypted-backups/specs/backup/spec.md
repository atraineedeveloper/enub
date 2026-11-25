# Backup

## ADDED Requirements
### Requirement: encrypted off-site backup
The system SHALL export SQL daily and Storage weekly, allow manual full backup, and publish only ciphertext with checksum.
#### Scenario: missing credentials or exceeded cap
- WHEN required credentials are absent or projected repository backup usage exceeds 350 MB
- THEN the workflow fails without publishing plaintext or partial data.
### Requirement: recoverability
The operator SHALL retain the age private identity outside GitHub and verify a restore in an isolated environment before production migration.
#### Scenario: restore rehearsal
- WHEN a backup is decrypted with the offline identity
- THEN the operator verifies the internal manifest and restores into a disposable nonproduction environment.
