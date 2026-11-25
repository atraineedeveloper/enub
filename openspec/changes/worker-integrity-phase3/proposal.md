# Worker data integrity

Repair the confirmed identity sequence drift separately from atomic creation and validation. Preserve worker IDs and existing rows; do not run remote mutations before explicit approval. Supersedes the proposed PR55 after review. Keep current edit RPC, RLS ownership and no worker deletion policy.
